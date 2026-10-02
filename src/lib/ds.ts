/**
 * TypeScript mirrors of the C data structures in `c-backend/ds.c`.
 *
 * The C backend is the source of truth (it runs the HTTP API and the WASM
 * engine behind the DS Lab). These implementations keep the *semantics*
 * identical — same capacities, same return conventions, same operations — so
 * Convex functions can apply the same stack / queue / priority-queue /
 * linked-list / BST / graph logic server-side when it can't ship a .wasm file.
 */

/* ----------------------------- Stack (LIFO) ----------------------------- */

export class Stack<T> {
  private items: T[] = [];
  push(v: T): boolean {
    this.items.push(v);
    return true;
  }
  pop(): T | null {
    return this.items.pop() ?? null;
  }
  peek(): T | null {
    return this.items.length ? this.items[this.items.length - 1] : null;
  }
  size(): number {
    return this.items.length;
  }
  isEmpty(): boolean {
    return this.items.length === 0;
  }
  /** bottom → top */
  toArray(): T[] {
    return [...this.items];
  }
  /** newest first (how history is displayed) */
  toLifo(): T[] {
    return [...this.items].reverse();
  }
}

/* ----------------------------- Queue (FIFO) ----------------------------- */

export class Queue<T> {
  private items: T[] = [];
  enqueue(v: T): boolean {
    this.items.push(v);
    return true;
  }
  dequeue(): T | null {
    return this.items.length ? (this.items.shift() as T) : null;
  }
  front(): T | null {
    return this.items.length ? this.items[0] : null;
  }
  size(): number {
    return this.items.length;
  }
  isEmpty(): boolean {
    return this.items.length === 0;
  }
  toArray(): T[] {
    return [...this.items];
  }
}

/* --------------------------- Priority queue ----------------------------- */

export interface PqItem {
  id: number;
  priority: number;
}

/** Binary min-heap — identical sift-up/sift-down to `pq_insert`/`pq_extract_min`. */
export class MinHeapPQ {
  private items: PqItem[] = [];

  get size(): number {
    return this.items.length;
  }

  insert(id: number, priority: number): boolean {
    this.items.push({ id, priority });
    // sift up
    let idx = this.items.length - 1;
    while (idx > 0) {
      const p = Math.floor((idx - 1) / 2);
      if (this.items[p].priority <= this.items[idx].priority) break;
      const t = this.items[p];
      this.items[p] = this.items[idx];
      this.items[idx] = t;
      idx = p;
    }
    return true;
  }

  extractMin(): PqItem | null {
    if (!this.items.length) return null;
    const min = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.items[l].priority < this.items[m].priority) m = l;
        if (r < this.items.length && this.items[r].priority < this.items[m].priority) m = r;
        if (m === i) break;
        const t = this.items[m];
        this.items[m] = this.items[i];
        this.items[i] = t;
        i = m;
      }
    }
    return min;
  }

  peek(): PqItem | null {
    return this.items.length ? this.items[0] : null;
  }

  /** raw heap array (level order) */
  heapArray(): PqItem[] {
    return [...this.items];
  }

  /** drain into ascending priority order */
  drain(): PqItem[] {
    const out: PqItem[] = [];
    let it = this.extractMin();
    while (it) {
      out.push(it);
      it = this.extractMin();
    }
    return out;
  }
}

/* --------------------------- Singly linked list ------------------------- */

interface LLNode<T> {
  value: T;
  next: LLNode<T> | null;
}

export class LinkedList<T> {
  private head: LLNode<T> | null = null;
  private count = 0;

  pushFront(v: T): boolean {
    this.head = { value: v, next: this.head };
    this.count++;
    return true;
  }

  pushBack(v: T): boolean {
    const node: LLNode<T> = { value: v, next: null };
    if (!this.head) {
      this.head = node;
    } else {
      let cur = this.head;
      while (cur.next) cur = cur.next;
      cur.next = node;
    }
    this.count++;
    return true;
  }

  delete(v: T): boolean {
    let prev: LLNode<T> | null = null;
    let cur = this.head;
    while (cur) {
      if (cur.value === v) {
        if (prev) prev.next = cur.next;
        else this.head = cur.next;
        this.count--;
        return true;
      }
      prev = cur;
      cur = cur.next;
    }
    return false;
  }

  contains(v: T): boolean {
    let cur = this.head;
    while (cur) {
      if (cur.value === v) return true;
      cur = cur.next;
    }
    return false;
  }

  size(): number {
    return this.count;
  }

  toArray(): T[] {
    const out: T[] = [];
    let cur = this.head;
    while (cur) {
      out.push(cur.value);
      cur = cur.next;
    }
    return out;
  }
}

/* ------------------------- Binary search tree --------------------------- */

interface BstNode {
  key: number;
  left: BstNode | null;
  right: BstNode | null;
}

export type BstInsertResult = "inserted" | "duplicate" | "full";

/** Mirrors `bst_insert` / `bst_delete` / `bst_search_depth` in ds.c. */
export class BST {
  private root: BstNode | null = null;
  private count = 0;
  private readonly capacity: number;

  constructor(capacity = 128) {
    this.capacity = capacity;
  }

  insert(key: number): BstInsertResult {
    if (!this.root) {
      this.root = { key, left: null, right: null };
      this.count = 1;
      return "inserted";
    }
    let cur = this.root;
    for (;;) {
      if (key === cur.key) return "duplicate";
      if (key < cur.key) {
        if (!cur.left) {
          if (this.count >= this.capacity) return "full";
          cur.left = { key, left: null, right: null };
          this.count++;
          return "inserted";
        }
        cur = cur.left;
      } else {
        if (!cur.right) {
          if (this.count >= this.capacity) return "full";
          cur.right = { key, left: null, right: null };
          this.count++;
          return "inserted";
        }
        cur = cur.right;
      }
    }
  }

  contains(key: number): boolean {
    let cur = this.root;
    while (cur) {
      if (key === cur.key) return true;
      cur = key < cur.key ? cur.left : cur.right;
    }
    return false;
  }

  /** depth of a hit (root = 0), -1 when missing — same contract as C */
  searchDepth(key: number): number {
    let cur = this.root;
    let depth = 0;
    while (cur) {
      if (key === cur.key) return depth;
      cur = key < cur.key ? cur.left : cur.right;
      depth++;
    }
    return -1;
  }

  delete(key: number): boolean {
    const removed = this.deleteRec(this.rootRef(), key);
    if (removed) this.count--;
    return removed;
  }

  private rootRef(): { node: BstNode | null } {
    const self = this;
    return {
      get node() {
        return self.root;
      },
      set node(v: BstNode | null) {
        self.root = v;
      },
    };
  }

  private deleteRec(ref: { node: BstNode | null }, key: number): boolean {
    const cur = ref.node;
    if (!cur) return false;
    if (key < cur.key) return this.deleteRec(nodeRef(cur, "left"), key);
    if (key > cur.key) return this.deleteRec(nodeRef(cur, "right"), key);
    if (!cur.left && !cur.right) {
      ref.node = null;
    } else if (!cur.left) {
      ref.node = cur.right;
    } else if (!cur.right) {
      ref.node = cur.left;
    } else {
      let parent = cur;
      let succ = cur.right;
      while (succ.left) {
        parent = succ;
        succ = succ.left;
      }
      cur.key = succ.key;
      if (parent === cur) parent.right = succ.right;
      else parent.left = succ.right;
    }
    return true;
  }

  inorder(): number[] {
    const out: number[] = [];
    const walk = (n: BstNode | null) => {
      if (!n) return;
      walk(n.left);
      out.push(n.key);
      walk(n.right);
    };
    walk(this.root);
    return out;
  }

  height(): number {
    const h = (n: BstNode | null): number => (n ? 1 + Math.max(h(n.left), h(n.right)) : -1);
    return h(this.root);
  }

  size(): number {
    return this.count;
  }

  clear(): void {
    this.root = null;
    this.count = 0;
  }
}

function nodeRef(node: BstNode, side: "left" | "right"): { node: BstNode | null } {
  return {
    get node() {
      return node[side];
    },
    set node(v: BstNode | null) {
      node[side] = v;
    },
  };
}

/* -------------------------------- Graph --------------------------------- */

/** Adjacency matrix + BFS/DFS exactly like `graph_bfs` / `graph_dfs` in C. */
export class Graph {
  private readonly n: number;
  private adj: number[][];

  constructor(n: number) {
    this.n = n;
    this.adj = Array.from({ length: n }, () => new Array(n).fill(0));
  }

  addEdge(a: number, b: number): boolean {
    if (a < 0 || b < 0 || a >= this.n || b >= this.n || a === b) return false;
    this.adj[a][b] = 1;
    this.adj[b][a] = 1;
    return true;
  }

  hasEdge(a: number, b: number): boolean {
    return a >= 0 && b >= 0 && a < this.n && b < this.n && this.adj[a][b] === 1;
  }

  bfs(start: number): number[] {
    if (start < 0 || start >= this.n) return [];
    const visited = new Array(this.n).fill(false);
    const q = new Queue<number>();
    const order: number[] = [];
    visited[start] = true;
    q.enqueue(start);
    while (!q.isEmpty()) {
      const u = q.dequeue()!;
      order.push(u);
      for (let i = 0; i < this.n; i++) {
        if (this.adj[u][i] && !visited[i]) {
          visited[i] = true;
          q.enqueue(i);
        }
      }
    }
    return order;
  }

  dfs(start: number): number[] {
    if (start < 0 || start >= this.n) return [];
    const visited = new Array(this.n).fill(false);
    const order: number[] = [];
    const walk = (u: number) => {
      visited[u] = true;
      order.push(u);
      for (let i = 0; i < this.n; i++) if (this.adj[u][i] && !visited[i]) walk(i);
    };
    walk(start);
    return order;
  }
}

/* ------------------------------- Helpers -------------------------------- */

export const MINUTES = 60 * 1000;

/** Urgency = minutes until expiry (clamped at 0). */
export function minutesUntil(expiresAt: number, now = Date.now()): number {
  return Math.max(0, Math.round((expiresAt - now) / MINUTES));
}

/**
 * Orders donations through the priority queue: soonest expiry is popped first.
 * This is the same operation the C server performs on `GET /api/donations`.
 */
export function orderByUrgency<T extends { ref: number; expiresAt: number }>(
  items: T[],
  now = Date.now(),
): T[] {
  const pq = new MinHeapPQ();
  for (const item of items) pq.insert(item.ref, minutesUntil(item.expiresAt, now));
  const byRef = new Map(items.map((i) => [i.ref, i]));
  const out: T[] = [];
  for (const { id } of pq.drain()) {
    const item = byRef.get(id);
    if (item) out.push(item);
  }
  return out;
}
