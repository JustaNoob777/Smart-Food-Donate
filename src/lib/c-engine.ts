/**
 * Loads `public/ds.wasm` — the C data-structure engine (c-backend/ds.c +
 * wasm_api.c) compiled by clang — and wraps its integer ABI in a typed API.
 *
 * Every call the UI makes goes through real compiled C: pushes land in the C
 * stack array, requests are queued by the C circular buffer, donations are
 * ordered by the C binary min-heap, and searches walk the C binary search
 * tree. The engine also streams a human-readable trace of its own operations.
 */

export interface CWasmExports {
  memory: WebAssembly.Memory;
  c_alloc(bytes: number): number;
  c_arena_reset(): void;
  c_trace_ptr(): number;
  c_trace_len(): number;
  c_trace_clear(): void;
  c_engine_name(): number;
  c_engine_reset(): void;
  c_stack_push(v: number): number;
  c_stack_pop(): number;
  c_stack_peek(): number;
  c_stack_size(): number;
  c_stack_at(i: number): number;
  c_stack_clear(): void;
  c_queue_enqueue(v: number): number;
  c_queue_dequeue(): number;
  c_queue_front(): number;
  c_queue_size(): number;
  c_queue_at(i: number): number;
  c_queue_clear(): void;
  c_pq_insert(id: number, prio: number): number;
  c_pq_extract(): number;
  c_pq_extract_prio(): number;
  c_pq_peek(): number;
  c_pq_peek_prio(): number;
  c_pq_size(): number;
  c_pq_id_at(i: number): number;
  c_pq_prio_at(i: number): number;
  c_pq_clear(): void;
  c_ll_push_front(v: number): number;
  c_ll_push_back(v: number): number;
  c_ll_delete(v: number): number;
  c_ll_contains(v: number): number;
  c_ll_size(): number;
  c_ll_at(i: number): number;
  c_ll_clear(): void;
  c_bst_insert(k: number): number;
  c_bst_delete(k: number): number;
  c_bst_contains(k: number): number;
  c_bst_search(k: number): number;
  c_bst_size(): number;
  c_bst_height(): number;
  c_bst_inorder(outPtr: number, cap: number): number;
  c_bst_clear(): void;
  c_graph_reset(n: number): void;
  c_graph_add_edge(a: number, b: number): number;
  c_graph_edge(a: number, b: number): number;
  c_graph_node_count(): number;
  c_graph_bfs(start: number, outPtr: number, cap: number): number;
  c_graph_dfs(start: number, outPtr: number, cap: number): number;
}

export interface HeapSlot {
  id: number;
  priority: number;
}

export class CEngine {
  private readonly ex: CWasmExports;
  private bstBuffer = 0;
  private graphBuffer = 0;
  private decoder = new TextDecoder();

  constructor(exports: CWasmExports) {
    this.ex = exports;
  }

  /* ------------------------------ memory ------------------------------ */

  private i32(ptr: number): Int32Array {
    return new Int32Array(this.ex.memory.buffer);
  }

  readCString(ptr: number): string {
    if (!ptr) return "";
    const bytes = new Uint8Array(this.ex.memory.buffer, ptr);
    let end = 0;
    while (end < bytes.length && bytes[end] !== 0) end++;
    return this.decoder.decode(bytes.subarray(0, end));
  }

  /* ------------------------------ trace ------------------------------- */

  /** Newest lines of the C engine's own operation log. */
  trace(): string[] {
    const len = this.ex.c_trace_len();
    if (len <= 0) return [];
    const bytes = new Uint8Array(this.ex.memory.buffer, this.ex.c_trace_ptr(), len);
    return this.decoder.decode(bytes).split("\n").filter(Boolean);
  }

  clearTrace(): void {
    this.ex.c_trace_clear();
  }

  engineName(): string {
    return this.readCString(this.ex.c_engine_name());
  }

  reset(): void {
    this.ex.c_engine_reset();
  }

  /* ------------------------------ stack ------------------------------- */

  stackPush(v: number): number {
    return this.ex.c_stack_push(v);
  }
  stackPop(): number {
    return this.ex.c_stack_pop();
  }
  stackPeek(): number {
    return this.ex.c_stack_peek();
  }
  stackSize(): number {
    return this.ex.c_stack_size();
  }
  stackAll(): number[] {
    const n = this.ex.c_stack_size();
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(this.ex.c_stack_at(i));
    return out;
  }
  stackClear(): void {
    this.ex.c_stack_clear();
  }

  /* ------------------------------ queue ------------------------------- */

  queueEnqueue(v: number): number {
    return this.ex.c_queue_enqueue(v);
  }
  queueDequeue(): number {
    return this.ex.c_queue_dequeue();
  }
  queueFront(): number {
    return this.ex.c_queue_front();
  }
  queueSize(): number {
    return this.ex.c_queue_size();
  }
  queueAll(): number[] {
    const n = this.ex.c_queue_size();
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(this.ex.c_queue_at(i));
    return out;
  }
  queueClear(): void {
    this.ex.c_queue_clear();
  }

  /* -------------------------- priority queue -------------------------- */

  pqInsert(id: number, priority: number): number {
    return this.ex.c_pq_insert(id, priority);
  }
  pqExtract(): { id: number; priority: number } {
    const id = this.ex.c_pq_extract();
    return { id, priority: this.ex.c_pq_extract_prio() };
  }
  pqPeek(): { id: number; priority: number } | null {
    if (this.ex.c_pq_size() <= 0) return null;
    return { id: this.ex.c_pq_peek(), priority: this.ex.c_pq_peek_prio() };
  }
  pqSize(): number {
    return this.ex.c_pq_size();
  }
  pqHeap(): HeapSlot[] {
    const n = this.ex.c_pq_size();
    const out: HeapSlot[] = [];
    for (let i = 0; i < n; i++) out.push({ id: this.ex.c_pq_id_at(i), priority: this.ex.c_pq_prio_at(i) });
    return out;
  }
  pqClear(): void {
    this.ex.c_pq_clear();
  }

  /**
   * Orders ids through the C min-heap (soonest deadline first) without
   * consuming the live heap — used by the Browse page to sort donations.
   */
  pqOrder(entries: Array<{ id: number; priority: number }>): number[] {
    this.ex.c_pq_clear();
    for (const e of entries) this.ex.c_pq_insert(e.id, e.priority);
    const out: number[] = [];
    for (let i = 0; i < entries.length; i++) out.push(this.ex.c_pq_extract());
    return out;
  }

  /* --------------------------- linked list ---------------------------- */

  llPushFront(v: number): number {
    return this.ex.c_ll_push_front(v);
  }
  llPushBack(v: number): number {
    return this.ex.c_ll_push_back(v);
  }
  llDelete(v: number): boolean {
    return this.ex.c_ll_delete(v) === 1;
  }
  llContains(v: number): boolean {
    return this.ex.c_ll_contains(v) === 1;
  }
  llSize(): number {
    return this.ex.c_ll_size();
  }
  llAll(): number[] {
    const n = this.ex.c_ll_size();
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(this.ex.c_ll_at(i));
    return out;
  }
  llClear(): void {
    this.ex.c_ll_clear();
  }

  /* ------------------------------- BST -------------------------------- */

  /** 0 inserted · 1 duplicate · -1 full */
  bstInsert(key: number): number {
    return this.ex.c_bst_insert(key);
  }
  bstDelete(key: number): boolean {
    return this.ex.c_bst_delete(key) === 1;
  }
  bstContains(key: number): boolean {
    return this.ex.c_bst_contains(key) === 1;
  }
  /** depth of the hit (root = 0) or -1 — traces the full search path */
  bstSearch(key: number): number {
    return this.ex.c_bst_search(key);
  }
  bstSize(): number {
    return this.ex.c_bst_size();
  }
  bstHeight(): number {
    return this.ex.c_bst_height();
  }
  bstInorder(): number[] {
    if (!this.bstBuffer) this.bstBuffer = this.ex.c_alloc(128 * 4);
    const n = this.ex.c_bst_inorder(this.bstBuffer, 128);
    const arr = this.i32(this.bstBuffer);
    return Array.from(arr.subarray(0, n));
  }
  bstClear(): void {
    this.ex.c_bst_clear();
  }

  /* ------------------------------ graph ------------------------------- */

  graphReset(nodes: number): void {
    this.ex.c_graph_reset(nodes);
  }
  graphAddEdge(a: number, b: number): number {
    return this.ex.c_graph_add_edge(a, b);
  }
  graphHasEdge(a: number, b: number): boolean {
    return this.ex.c_graph_edge(a, b) === 1;
  }
  graphNodeCount(): number {
    return this.ex.c_graph_node_count();
  }
  graphBfs(start: number): number[] {
    if (!this.graphBuffer) this.graphBuffer = this.ex.c_alloc(16 * 4);
    const n = this.ex.c_graph_bfs(start, this.graphBuffer, 16);
    return Array.from(this.i32(this.graphBuffer).subarray(0, n));
  }
  graphDfs(start: number): number[] {
    if (!this.graphBuffer) this.graphBuffer = this.ex.c_alloc(16 * 4);
    const n = this.ex.c_graph_dfs(start, this.graphBuffer, 16);
    return Array.from(this.i32(this.graphBuffer).subarray(0, n));
  }
}

const WASM_URL = `${import.meta.env.BASE_URL ?? "/"}ds.wasm`.replace("//", "/");
let enginePromise: Promise<CEngine> | null = null;

/** Fetch + instantiate the C engine (cached promise; safe to call often). */
export function loadCEngine(): Promise<CEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const res = await fetch(WASM_URL);
      if (!res.ok) throw new Error(`Could not load ds.wasm (HTTP ${res.status})`);
      const bytes = await res.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      const exports = instance.exports as unknown as CWasmExports;
      if (typeof exports.c_stack_push !== "function" || !exports.memory) {
        throw new Error("ds.wasm is missing expected exports");
      }
      const engine = new CEngine(exports);
      engine.reset();
      return engine;
    })().catch((err) => {
      enginePromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return enginePromise;
}
