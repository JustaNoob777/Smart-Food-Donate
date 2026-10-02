import { AppShell } from "@/components/AppShell";
import { ClayBadge, PageHeader } from "@/components/ui-clay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCEngine } from "@/hooks/use-c-engine";
import { CEngine } from "@/lib/c-engine";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  Braces,
  CircleDot,
  Eraser,
  Layers,
  ListOrdered,
  Network,
  Play,
  RefreshCw,
  Search,
  Server,
  Timer,
  Trash2,
} from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

type TabKey = "stack" | "queue" | "pq" | "list" | "bst" | "graph";

const TABS: Array<{ key: TabKey; label: string; icon: typeof Layers; role: string }> = [
  { key: "stack", label: "Stack", icon: Layers, role: "recent actions" },
  { key: "queue", label: "Queue", icon: ListOrdered, role: "pending requests" },
  { key: "pq", label: "Priority queue", icon: Timer, role: "expiry ordering" },
  { key: "list", label: "Linked list", icon: ArrowRight, role: "route steps" },
  { key: "bst", label: "BST", icon: Search, role: "id lookup" },
  { key: "graph", label: "Graph", icon: Network, role: "BFS / DFS" },
];

const SNIPPETS: Record<TabKey, string> = {
  stack: `int stack_push(Stack *s, int v) {
  if (s->top >= STACK_CAP) return -1;
  s->items[s->top++] = v;
  return 0;
}`,
  queue: `int queue_enqueue(Queue *q, int v) {
  if (q->count >= QUEUE_CAP) return -1;
  q->items[q->tail] = v;
  q->tail = (q->tail + 1) % QUEUE_CAP;
  q->count++;
  return 0;
}`,
  pq: `int pq_insert(PriorityQueue *pq, int id, int priority) {
  int i = pq->size++;
  pq->items[i].id = id;
  pq->items[i].priority = priority;
  while (i > 0) {                    /* sift up */
    int p = (i - 1) / 2;
    if (pq->items[p].priority <= pq->items[i].priority) break;
    swap(&pq->items[p], &pq->items[i]);
    i = p;
  }
  return 0;
}`,
  list: `int ll_push_back(LinkedList *l, int v) {
  int idx = ll_alloc(l);
  if (idx < 0) return -1;
  l->pool[idx].value = v;
  l->pool[idx].next = -1;
  /* walk to the tail and link */
  ...
}`,
  bst: `int bst_search_depth(const BST *t, int key) {
  int cur = t->root, depth = 0;
  while (cur != -1) {
    if (key == t->pool[cur].key) return depth;
    cur = key < t->pool[cur].key
        ? t->pool[cur].left : t->pool[cur].right;
    depth++;
  }
  return -1;
}`,
  graph: `int graph_bfs(const Graph *g, int start, int *order, int cap) {
  int visited[GRAPH_MAX_NODES], q[GRAPH_MAX_NODES];
  ...
  visited[start] = 1;
  q[qt++] = start;
  while (qh < qt && count < cap) {
    int u = q[qh++];
    order[count++] = u;
    for (i = 0; i < g->n; i++)
      if (g->adj[u][i] && !visited[i]) {
        visited[i] = 1;
        q[qt++] = i;
      }
  }
  return count;
}`,
};

const STACK_LABELS: Record<number, string> = {
  1: "donation posted",
  2: "request enqueued",
  3: "request claimed",
  4: "food collected",
  5: "food distributed",
  6: "heap rebuilt",
};

const LL_LABELS: Record<number, string> = {
  1: "Restaurant",
  2: "Central hub",
  3: "Volunteer",
  4: "Recipient",
};

const PQ_TITLES: Record<number, string> = {
  1001: "Rice + Curry",
  1002: "Veg Pack",
  1003: "Bread & Snacks",
  1004: "Fruit Boxes",
  1005: "Sambar Meals",
  1006: "Milk & Cereals",
  1007: "Roti & Paneer",
  1008: "Seafood Rice",
};

const GRAPH_NODES = [
  "Sunshine Rest.",
  "Green Bistro",
  "Central Hub",
  "Hope Foundation",
  "Rise Together",
  "Community Fridge",
];

const GRAPH_POS = [
  { x: 46, y: 52 },
  { x: 46, y: 158 },
  { x: 168, y: 105 },
  { x: 302, y: 52 },
  { x: 302, y: 158 },
  { x: 392, y: 105 },
];

/** Re-seeds every structure with domain-flavoured demo data. */
function seedEngine(engine: CEngine) {
  engine.reset();
  [1, 6, 2, 3, 5].forEach((v) => engine.stackPush(v));
  [5001, 5004, 5005, 5006].forEach((v) => engine.queueEnqueue(v));
  (
    [
      [1005, 90],
      [1007, 240],
      [1001, 360],
      [1004, 540],
      [1008, 720],
      [1002, 1560],
    ] as Array<[number, number]>
  ).forEach(([id, p]) => engine.pqInsert(id, p));
  [1, 2, 3, 4].forEach((v) => engine.llPushBack(v));
  [1005, 1001, 1007, 1003, 1008, 1002, 1004, 1006].forEach((k) => engine.bstInsert(k));
  engine.graphReset(6);
  (
    [
      [0, 2],
      [1, 2],
      [2, 3],
      [2, 4],
      [3, 5],
      [4, 5],
    ] as Array<[number, number]>
  ).forEach(([a, b]) => engine.graphAddEdge(a, b));
  engine.clearTrace();
}

/* ------------------------------------------------------------------ */
/* small building blocks                                               */
/* ------------------------------------------------------------------ */
function PanelCard({ title, hint, badge, children }: {
  title: string;
  hint?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="clay p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold">{title}</h3>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function OpRow({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>;
}

function OpButton({ onClick, children, tone = "outline" }: {
  onClick: () => void;
  children: ReactNode;
  tone?: "default" | "outline";
}) {
  return (
    <Button size="sm" variant={tone} onClick={onClick} className="font-bold">
      {children}
    </Button>
  );
}

function StatChip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="clay-inset px-3.5 py-2 text-center">
      <p className="text-lg leading-5 font-extrabold tabular-nums">{value}</p>
      <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function ValueInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode="numeric"
      className="h-9 w-28 font-mono font-bold"
    />
  );
}

function parse(value: string, label: string): number | null {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) {
    toast.error(`${label} must be a whole number`);
    return null;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Stack                                                               */
/* ------------------------------------------------------------------ */
function StackPanel({ engine, bump }: { engine: CEngine; bump: () => void }) {
  const [v, setV] = useState("42");
  const items = engine.stackAll();
  const peek = engine.stackPeek();

  return (
    <PanelCard
      title="Recent actions history"
      hint="Last-in, first-out — the newest action is always on top."
      badge={<ClayBadge className="bg-[#dbe7f7] text-[#2c4a77]">stack · LIFO</ClayBadge>}
    >
      <div className="mt-5 grid gap-6 md:grid-cols-[1fr_auto]">
        <div className="clay-inset flex min-h-64 flex-col-reverse justify-start gap-2 overflow-y-auto p-4 clay-scroll">
          {items.length === 0 ? (
            <p className="m-auto text-sm text-muted-foreground">Stack empty — pop() would underflow.</p>
          ) : (
            items.map((item, i) => (
              <div
                key={`${item}-${i}`}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-2.5 shadow-sm",
                  i === items.length - 1 ? "clay-tile-amber text-[#3a2a10]" : "bg-card",
                )}
              >
                <span className="text-sm font-extrabold">{item}</span>
                <span className="text-xs font-semibold opacity-80">
                  {STACK_LABELS[item] ?? `action ${item}`}
                </span>
                <span className="text-[10px] font-bold opacity-70 tabular-nums">idx {i}</span>
              </div>
            ))
          )}
        </div>

        <div className="flex w-full flex-col gap-3 md:w-52">
          <div className="grid grid-cols-2 gap-2">
            <StatChip label="size" value={items.length} />
            <StatChip label="top" value={peek >= 0 ? peek : "—"} />
          </div>
          <div className="clay-inset px-3 py-2.5 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase">← top = next pop()</p>
          </div>
        </div>
      </div>

      <OpRow>
        <ValueInput value={v} onChange={setV} placeholder="value" />
        <OpButton
          tone="default"
          onClick={() => {
            const n = parse(v, "Value");
            if (n !== null) { engine.stackPush(n); bump(); }
          }}
        >
          stack_push
        </OpButton>
        <OpButton onClick={() => { engine.stackPop(); bump(); }}>stack_pop</OpButton>
        <OpButton onClick={() => { engine.stackPeek(); bump(); }}>stack_peek</OpButton>
        <OpButton onClick={() => { engine.stackClear(); bump(); }}>
          <Eraser className="size-3.5" /> clear
        </OpButton>
      </OpRow>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */
function QueuePanel({ engine, bump }: { engine: CEngine; bump: () => void }) {
  const [v, setV] = useState("5005");
  const items = engine.queueAll();

  return (
    <PanelCard
      title="Pending collection requests"
      hint="First in, first out — the oldest request is always at the head."
      badge={<ClayBadge className="bg-[#fdecc8] text-[#7a5410]">queue · FIFO</ClayBadge>}
    >
      <div className="clay-inset mt-5 overflow-x-auto px-4 py-5 clay-scroll">
        <div className="flex min-w-max items-center gap-3">
          {items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Queue empty — dequeue() returns nothing.</p>
          ) : (
            items.map((item, i) => (
              <div key={`${item}-${i}`} className="flex items-center gap-3">
                <div
                  className={cn(
                    "min-w-32 rounded-2xl px-4 py-3 text-center shadow-sm",
                    i === 0 ? "clay-tile-sage text-[#2f4a26]" : "bg-card",
                  )}
                >
                  <p className="text-sm font-extrabold tabular-nums">REQ #{item}</p>
                  <p className="text-[10px] font-bold uppercase opacity-80">
                    {i === 0 ? "head · next served" : i === items.length - 1 ? "tail" : `pos ${i}`}
                  </p>
                </div>
                {i < items.length - 1 && <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}
              </div>
            ))
          )}
        </div>
      </div>

      <OpRow>
        <ValueInput value={v} onChange={setV} placeholder="id" />
        <OpButton
          tone="default"
          onClick={() => {
            const n = parse(v, "Id");
            if (n !== null) { engine.queueEnqueue(n); bump(); }
          }}
        >
          queue_enqueue
        </OpButton>
        <OpButton onClick={() => { engine.queueDequeue(); bump(); }}>queue_dequeue</OpButton>
        <OpButton onClick={() => { engine.queueFront(); bump(); }}>queue_front</OpButton>
        <OpButton onClick={() => { engine.queueClear(); bump(); }}>
          <Eraser className="size-3.5" /> clear
        </OpButton>
      </OpRow>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Priority queue (binary heap tree view)                              */
/* ------------------------------------------------------------------ */
function PqPanel({ engine, bump }: { engine: CEngine; bump: () => void }) {
  const [id, setId] = useState("1010");
  const [prio, setPrio] = useState("30");
  const [last, setLast] = useState<{ id: number; priority: number } | null>(null);

  const heap = engine.pqHeap();
  const peek = engine.pqPeek();

  // tree layout for the heap array
  const W = 440;
  const nodeR = 26;
  const positions = heap.map((_, i) => {
    const depth = Math.floor(Math.log2(i + 1));
    const first = Math.pow(2, depth) - 1;
    const idx = i - first;
    const count = Math.pow(2, depth);
    return {
      x: ((idx + 0.5) / count) * W,
      y: 44 + depth * 74,
      depth,
    };
  });
  const H = positions.length ? positions[positions.length - 1].y + 44 : 90;

  return (
    <PanelCard
      title="Donations ordered by expiry"
      hint="Binary min-heap: the root is always the food that spoils soonest."
      badge={<ClayBadge className="bg-[#fdecc8] text-[#7a5410]">priority queue · min-heap</ClayBadge>}
    >
      <div className="clay-inset mt-5 overflow-x-auto px-4 py-4 clay-scroll">
        {heap.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Heap empty.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[420px]">
            {positions.map((p, i) => {
              if (i === 0) return null;
              const parent = positions[Math.floor((i - 1) / 2)];
              return (
                <line
                  key={`e${i}`}
                  x1={parent.x}
                  y1={parent.y}
                  x2={p.x}
                  y2={p.y}
                  stroke="color-mix(in srgb, var(--muted-foreground) 45%, transparent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              );
            })}
            {heap.map((slot, i) => {
              const p = positions[i];
              const isRoot = i === 0;
              return (
                <g key={`${slot.id}-${i}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={nodeR}
                    fill={isRoot ? "#e9a23b" : "#fcf8f1"}
                    stroke={isRoot ? "#c07f1d" : "#e7dcc9"}
                    strokeWidth="3"
                  />
                  <text
                    x={p.x}
                    y={p.y - 2}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="800"
                    fill={isRoot ? "#3a2a10" : "#3d3831"}
                  >
                    {slot.id}
                  </text>
                  <text
                    x={p.x}
                    y={p.y + 12}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="700"
                    fill={isRoot ? "#5a3d0c" : "#7e7566"}
                  >
                    {slot.priority}m
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatChip label="heap size" value={heap.length} />
        <StatChip label="min id" value={peek ? peek.id : "—"} />
        <StatChip label="expires in" value={peek ? `${peek.priority}m` : "—"} />
      </div>

      {last && (
        <div className="clay-inset mt-3 flex items-center gap-2 px-4 py-3 text-xs font-bold">
          <Play className="size-3.5 text-[#4a7a38]" />
          last extract: #{last.id} — the most urgent donation ({last.priority}m left)
        </div>
      )}

      <OpRow>
        <ValueInput value={id} onChange={setId} placeholder="donation id" />
        <ValueInput value={prio} onChange={setPrio} placeholder="minutes" />
        <OpButton
          tone="default"
          onClick={() => {
            const a = parse(id, "Id");
            const b = parse(prio, "Minutes");
            if (a !== null && b !== null) { engine.pqInsert(a, b); bump(); }
          }}
        >
          pq_insert
        </OpButton>
        <OpButton
          onClick={() => {
            const res = engine.pqExtract();
            setLast(res);
            bump();
          }}
        >
          pq_extract_min
        </OpButton>
        <OpButton onClick={() => { engine.pqClear(); bump(); }}>
          <Eraser className="size-3.5" /> clear
        </OpButton>
      </OpRow>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Linked list                                                         */
/* ------------------------------------------------------------------ */
function ListPanel({ engine, bump }: { engine: CEngine; bump: () => void }) {
  const [v, setV] = useState("5");
  const items = engine.llAll();

  return (
    <PanelCard
      title="Delivery route"
      hint="Nodes are allocated from a fixed pool and linked tail-ward."
      badge={<ClayBadge className="bg-[#d5ead0] text-[#2f5224]">linked list · singly</ClayBadge>}
    >
      <div className="clay-inset mt-5 overflow-x-auto px-4 py-5 clay-scroll">
        <div className="flex min-w-max items-center gap-3">
          {items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">List empty — head = NULL.</p>
          ) : (
            items.map((item, i) => (
              <div key={`${item}-${i}`} className="flex items-center gap-3">
                <div className="min-w-36 rounded-2xl bg-card px-4 py-3 text-center shadow-sm">
                  <p className="text-sm font-extrabold">{LL_LABELS[item] ?? `step ${item}`}</p>
                  <p className="font-mono text-[10px] font-bold text-muted-foreground">value={item}</p>
                </div>
                {i < items.length - 1 && (
                  <span className="flex items-center">
                    <span className="h-0.5 w-6 bg-muted-foreground/50" />
                    <ArrowRight className="size-4 -ml-1 text-muted-foreground" />
                  </span>
                )}
              </div>
            ))
          )}
          {items.length > 0 && (
            <span className="ml-1 rounded-full bg-card px-3 py-1 text-[10px] font-bold text-muted-foreground shadow-sm">
              NULL
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-xs">
        <StatChip label="nodes" value={items.length} />
        <StatChip label="head" value={items.length ? items[0] : "NULL"} />
      </div>

      <OpRow>
        <ValueInput value={v} onChange={setV} placeholder="value" />
        <OpButton
          tone="default"
          onClick={() => {
            const n = parse(v, "Value");
            if (n !== null) { engine.llPushBack(n); bump(); }
          }}
        >
          ll_push_back
        </OpButton>
        <OpButton
          onClick={() => {
            const n = parse(v, "Value");
            if (n !== null) { engine.llDelete(n); bump(); }
          }}
        >
          ll_delete
        </OpButton>
        <OpButton
          onClick={() => {
            const n = parse(v, "Value");
            if (n !== null) { engine.llPushFront(n); bump(); }
          }}
        >
          ll_push_front
        </OpButton>
        <OpButton onClick={() => { engine.llClear(); bump(); }}>
          <Eraser className="size-3.5" /> clear
        </OpButton>
      </OpRow>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* BST — tree view                                                     */
/* ------------------------------------------------------------------ */
type MNode = { key: number; left: MNode | null; right: MNode | null };

function mirrorInsert(node: MNode | null, key: number): { root: MNode | null; ok: boolean } {
  if (!node) return { root: { key, left: null, right: null }, ok: true };
  if (key === node.key) return { root: node, ok: false };
  if (key < node.key) {
    const res = mirrorInsert(node.left, key);
    node.left = res.root;
    return { root: node, ok: res.ok };
  }
  const res = mirrorInsert(node.right, key);
  node.right = res.root;
  return { root: node, ok: res.ok };
}

function mirrorDelete(node: MNode | null, key: number): { root: MNode | null; ok: boolean } {
  if (!node) return { root: null, ok: false };
  if (key < node.key) {
    const res = mirrorDelete(node.left, key);
    node.left = res.root;
    return { root: node, ok: res.ok };
  }
  if (key > node.key) {
    const res = mirrorDelete(node.right, key);
    node.right = res.root;
    return { root: node, ok: res.ok };
  }
  if (!node.left && !node.right) return { root: null, ok: true };
  if (!node.left) return { root: node.right, ok: true };
  if (!node.right) return { root: node.left, ok: true };
  let succ = node.right;
  while (succ.left) succ = succ.left;
  const res = mirrorInsert(node.right, succ.key);
  node.right = res.root;
  node.key = succ.key;
  return { root: node, ok: true };
}

const SEED_BST_KEYS = [1005, 1001, 1007, 1003, 1008, 1002, 1004, 1006];

function buildMirror(ops: Array<{ type: "i" | "d"; key: number }>): MNode | null {
  let r: MNode | null = null;
  for (const op of ops) {
    r = (op.type === "i" ? mirrorInsert : mirrorDelete)(r, op.key).root;
  }
  return r;
}

function layout(root: MNode | null) {
  const COL = 56;
  const ROW = 76;
  const posOf = new Map<MNode, { x: number; y: number; depth: number }>();
  const ordered: MNode[] = [];
  let index = 0;

  // pass 1 — in-order positions (x grows left → right)
  const assign = (n: MNode | null, depth: number) => {
    if (!n) return;
    assign(n.left, depth + 1);
    posOf.set(n, { x: 34 + index * COL, y: 40 + depth * ROW, depth });
    ordered.push(n);
    index++;
    assign(n.right, depth + 1);
  };
  assign(root, 0);

  // pass 2 — parent/child edges
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const link = (n: MNode | null) => {
    if (!n) return;
    const p = posOf.get(n)!;
    if (n.left) {
      const c = posOf.get(n.left)!;
      edges.push({ x1: p.x, y1: p.y, x2: c.x, y2: c.y });
      link(n.left);
    }
    if (n.right) {
      const c = posOf.get(n.right)!;
      edges.push({ x1: p.x, y1: p.y, x2: c.x, y2: c.y });
      link(n.right);
    }
  };
  link(root);

  const nodes = ordered.map((n) => ({ key: n.key, ...posOf.get(n)! }));
  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), -1);
  return {
    nodes,
    edges,
    width: Math.max(360, (index + 1) * COL),
    height: 40 + (maxDepth + 1) * ROW,
  };
}

function BstPanel({ engine, bump, seedKey }: { engine: CEngine; bump: () => void; seedKey: number }) {
  const [v, setV] = useState("1009");
  const [root, setRoot] = useState<MNode | null>(null);
  const ops = useRef<Array<{ type: "i" | "d"; key: number }>>([]);

  // rebuild the visual mirror whenever the engine (re)seeds the real tree
  useEffect(() => {
    ops.current = SEED_BST_KEYS.map((key) => ({ type: "i" as const, key }));
    setRoot(buildMirror(ops.current));
  }, [seedKey]);

  const { nodes, edges, width, height } = layout(root);
  const inorder = engine.bstInorder();

  const doInsert = () => {
    const n = parse(v, "Key");
    if (n === null) return;
    const res = engine.bstInsert(n);
    if (res === 0) {
      ops.current = [...ops.current, { type: "i", key: n }];
      setRoot((prev) => mirrorInsert(prev, n).root);
    } else if (res === 1) toast.info(`Duplicate key ${n} rejected`);
    else toast.error("Tree full (128 node pool)");
    bump();
  };

  const doDelete = () => {
    const n = parse(v, "Key");
    if (n === null) return;
    const found = engine.bstDelete(n);
    if (found) {
      ops.current = [...ops.current, { type: "d", key: n }];
      setRoot((prev) => mirrorDelete(prev, n).root);
    } else toast.info(`${n} was not in the tree`);
    bump();
  };

  const doSearch = () => {
    const n = parse(v, "Key");
    if (n === null) return;
    const depth = engine.bstSearch(n);
    if (depth >= 0) toast.success(`Found ${n} at depth ${depth}`);
    else toast.info(`${n} is not in the tree`);
    bump();
  };

  return (
    <PanelCard
      title="Donation index by id"
      hint="Insert, search, delete — every hop the C code takes is printed in the console below."
      badge={<ClayBadge className="bg-[#d5ead0] text-[#2f5224]">binary search tree</ClayBadge>}
    >
      <div className="clay-inset mt-5 overflow-x-auto px-4 py-4 clay-scroll">
        {nodes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Tree empty — root = NULL.</p>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[380px]" style={{ width: width }}>
            {edges.map((e, i) => (
              <line
                key={i}
                x1={e.x1}
                y1={e.y1 + 20}
                x2={e.x2}
                y2={e.y2 - 20}
                stroke="color-mix(in srgb, var(--muted-foreground) 50%, transparent)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            ))}
            {nodes.map((n) => (
              <g key={n.key}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={20}
                  fill={n.depth === 0 ? "#e9a23b" : "#fcf8f1"}
                  stroke={n.depth === 0 ? "#c07f1d" : "#e7dcc9"}
                  strokeWidth="3"
                />
                <text
                  x={n.x}
                  y={n.y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="800"
                  fill={n.depth === 0 ? "#3a2a10" : "#3d3831"}
                >
                  {n.key}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:max-w-xl">
        <StatChip label="nodes" value={engine.bstSize()} />
        <StatChip label="height" value={engine.bstHeight()} />
        <StatChip label="root" value={nodes.find((nd) => nd.depth === 0)?.key ?? "—"} />
        <StatChip label="inorder" value={inorder.length} />
      </div>

      <p className="mt-3 font-mono text-[11px] font-bold text-[#4a7a38]">
        inorder: [{inorder.join(", ")}] — always ascending
      </p>

      <OpRow>
        <ValueInput value={v} onChange={setV} placeholder="id" />
        <OpButton tone="default" onClick={doInsert}>bst_insert</OpButton>
        <OpButton onClick={doSearch}>bst_search</OpButton>
        <OpButton onClick={doDelete}>bst_delete</OpButton>
        <OpButton
          onClick={() => {
            engine.bstClear();
            ops.current = [];
            setRoot(null);
            bump();
          }}
        >
          <Eraser className="size-3.5" /> clear
        </OpButton>
      </OpRow>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Graph                                                               */
/* ------------------------------------------------------------------ */
function GraphPanel({ engine, bump }: { engine: CEngine; bump: () => void }) {
  const [start, setStart] = useState("0");
  const [a, setA] = useState("0");
  const [b, setB] = useState("5");
  const [order, setOrder] = useState<Array<{ nodes: number[]; mode: string }> | null>(null);

  const n = engine.graphNodeCount();
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (engine.graphHasEdge(i, j)) edges.push([i, j]);

  const run = (mode: "bfs" | "dfs") => {
    const s = parse(start, "Start node");
    if (s === null) return;
    const nodes = mode === "bfs" ? engine.graphBfs(s) : engine.graphDfs(s);
    setOrder([{ nodes, mode }]);
    bump();
  };

  const visited = order?.[0]?.nodes ?? [];
  const rankOf = (i: number) => visited.indexOf(i);

  return (
    <PanelCard
      title="Distribution network"
      hint="Donors, a central hub and NGOs — BFS finds the shortest delivery path."
      badge={<ClayBadge className="bg-[#dbe7f7] text-[#2c4a77]">graph · adjacency matrix</ClayBadge>}
    >
      <div className="clay-inset mt-5 overflow-x-auto px-4 py-4 clay-scroll">
        <svg viewBox="0 0 440 210" className="h-auto w-full min-w-[420px]">
          {edges.map(([i, j]) => (
            <line
              key={`${i}-${j}`}
              x1={GRAPH_POS[i].x}
              y1={GRAPH_POS[i].y}
              x2={GRAPH_POS[j].x}
              y2={GRAPH_POS[j].y}
              stroke="color-mix(in srgb, var(--muted-foreground) 45%, transparent)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
          {GRAPH_NODES.slice(0, n).map((label, i) => {
            const rank = rankOf(i);
            const active = rank >= 0;
            return (
              <g key={label}>
                <circle
                  cx={GRAPH_POS[i].x}
                  cy={GRAPH_POS[i].y}
                  r={24}
                  fill={active ? (rank === 0 ? "#7fb069" : "#e9a23b") : "#fcf8f1"}
                  stroke={active ? "#c07f1d" : "#e7dcc9"}
                  strokeWidth="3"
                />
                <text
                  x={GRAPH_POS[i].x}
                  y={GRAPH_POS[i].y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="800"
                  fill={active ? "#3a2a10" : "#7e7566"}
                >
                  {active ? rank : i}
                </text>
                <text
                  x={GRAPH_POS[i].x}
                  y={GRAPH_POS[i].y + 40}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#7e7566"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {order && (
        <div className="clay-inset mt-4 flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">
            {order[0].mode}(
            {start}):
          </span>
          {order[0].nodes.map((node, i) => (
            <span
              key={`${node}-${i}`}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-sm",
                i === 0 ? "clay-tile-sage text-[#2f4a26]" : "bg-card",
              )}
            >
              {GRAPH_NODES[node]}
            </span>
          ))}
        </div>
      )}

      <OpRow>
        <ValueInput value={start} onChange={setStart} placeholder="from" />
        <OpButton tone="default" onClick={() => run("bfs")}>graph_bfs</OpButton>
        <OpButton onClick={() => run("dfs")}>graph_dfs</OpButton>
        <ValueInput value={a} onChange={setA} placeholder="u" />
        <ValueInput value={b} onChange={setB} placeholder="v" />
        <OpButton
          onClick={() => {
            const u = parse(a, "Node u");
            const w = parse(b, "Node v");
            if (u === null || w === null) return;
            if (engine.graphAddEdge(u, w) !== 0) toast.error("Invalid node id");
            bump();
          }}
        >
          add_edge
        </OpButton>
      </OpRow>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Trace console                                                       */
/* ------------------------------------------------------------------ */
function TraceConsole({ engine, tick }: { engine: CEngine | null; tick: number }) {
  const lines = engine ? engine.trace() : [];
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [tick, lines.length]);

  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-[#312c25] shadow-[14px_14px_30px_rgba(75,62,44,0.25)]">
      <div className="flex items-center justify-between px-5 py-3">
        <span className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-[#d9cdb6] uppercase">
          <Server className="size-3.5 text-[#e9a23b]" /> c-backend/ds.c · engine trace
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#9a917f]">
          <CircleDot className="size-3 text-[#7fb069]" /> live stdout
        </span>
      </div>
      <div
        ref={boxRef}
        className="clay-scroll max-h-64 overflow-y-auto border-t border-white/10 px-5 py-4 font-mono text-[11.5px] leading-6 text-[#efe6d6]"
      >
        {lines.length === 0 ? (
          <p className="text-[#9a917f]">/* run an operation to see the C engine respond */</p>
        ) : (
          lines.slice(-40).map((line, i) => (
            <p key={i} className="whitespace-pre-wrap break-words">
              <span className="text-[#7fb069]">➜</span> {line}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function DSLab() {
  const { engine, status, error } = useCEngine();
  const [params, setParams] = useSearchParams();
  const [tick, setTick] = useState(0);
  const [seedKey, setSeedKey] = useState(0);
  const seeded = useRef(false);

  const rawTab = params.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "stack";
  const setTab = (key: TabKey) => setParams({ tab: key }, { replace: true });
  const bump = () => setTick((t) => t + 1);

  useEffect(() => {
    if (engine && !seeded.current) {
      seeded.current = true;
      seedEngine(engine);
      setSeedKey((k) => k + 1);
      bump();
    }
  }, [engine]);

  const panel = (key: TabKey) => {
    if (!engine) return null;
    if (key === "stack") return <StackPanel engine={engine} bump={bump} />;
    if (key === "queue") return <QueuePanel engine={engine} bump={bump} />;
    if (key === "pq") return <PqPanel engine={engine} bump={bump} />;
    if (key === "list") return <ListPanel engine={engine} bump={bump} />;
    if (key === "bst") return <BstPanel engine={engine} bump={bump} seedKey={seedKey} />;
    return <GraphPanel engine={engine} bump={bump} />;
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <PageHeader
          title="C Engine Lab"
          subtitle="Every button below calls straight into ds.c, compiled to WebAssembly. The console prints the engine's own trace — the same code that runs the native HTTP backend."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <ClayBadge
                className={cn(
                  "px-3 py-1.5",
                  status === "ready" && "bg-[#d5ead0] text-[#2f5224]",
                  status === "loading" && "bg-[#fdecc8] text-[#7a5410]",
                  status === "error" && "bg-[#fadbd5] text-[#8a382b]",
                )}
              >
                <Braces className="size-3" />
                {status === "ready"
                  ? "ds.wasm loaded"
                  : status === "loading"
                    ? "loading ds.wasm…"
                    : "engine error"}
              </ClayBadge>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 font-bold"
                onClick={() => {
                  if (engine) {
                    seedEngine(engine);
                    setSeedKey((k) => k + 1);
                    bump();
                    toast.success("Engine re-seeded");
                  }
                }}
                disabled={!engine}
              >
                <RefreshCw className="size-3.5" /> Reset engine
              </Button>
            </div>
          }
        />

        {status === "error" && (
          <div className="clay mt-5 flex items-start gap-3 border-l-4 border-[#d96c5f] p-5">
            <Trash2 className="mt-0.5 size-4 shrink-0 text-[#d96c5f]" />
            <div>
              <p className="text-sm font-extrabold">Could not start the C engine</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_1fr]">
          {/* ------------------------- tab rail ------------------------- */}
          <nav className="clay h-fit p-3">
            <p className="px-3 pt-2 pb-3 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              Structures in ds.c
            </p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left transition-all lg:w-full",
                    tab === t.key
                      ? "clay-inset"
                      : "hover:bg-secondary/70",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-xl",
                      tab === t.key ? "clay-tile-amber text-[#5a3d0c]" : "bg-[#f4ede2] text-muted-foreground",
                    )}
                  >
                    <t.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">{t.label}</span>
                    <span className="block text-[10px] font-semibold text-muted-foreground">
                      {t.role}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 hidden rounded-2xl bg-[#f4ede2] p-3.5 lg:block">
              <p className="text-[11px] font-bold text-muted-foreground uppercase">Engine</p>
              <p className="mt-1 font-mono text-[11px] leading-5 font-bold">
                {engine ? engine.engineName() : "initializing…"}
              </p>
              <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                Native twin: <code className="font-bold">c-backend/foodshare-server</code>
              </p>
            </div>
          </nav>

          {/* -------------------------- content -------------------------- */}
          <div className="space-y-6">
            {status === "loading" ? (
              <div className="clay flex min-h-72 flex-col items-center justify-center gap-3 p-10 text-center">
                <RefreshCw className="size-6 animate-spin text-[#c07f1d]" />
                <p className="font-extrabold">Compiling thoughts in C…</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Fetching <code className="font-bold">ds.wasm</code> — the clang-built
                  data-structure engine.
                </p>
              </div>
            ) : (
              <>
                {panel(tab)}
                <div className="clay p-5">
                  <p className="flex items-center gap-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    <Activity className="size-3.5 text-[#c07f1d]" /> source · ds.c
                  </p>
                  <pre className="clay-inset mt-3 overflow-x-auto px-4 py-3.5 font-mono text-[11px] leading-5 clay-scroll">
                    {SNIPPETS[tab]}
                  </pre>
                </div>
                <TraceConsole engine={engine} tick={tick} />
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
