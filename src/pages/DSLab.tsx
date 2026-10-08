import { AppShell } from "@/components/AppShell";
import { ClayBadge, PageHeader } from "@/components/ui-clay";
import { Button } from "@/components/ui/button";
import { useCEngine } from "@/hooks/use-c-engine";
import { CEngine } from "@/lib/c-engine";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Braces,
  CircleDot,
  Layers,
  ListOrdered,
  Network,
  RefreshCw,
  Search,
  Server,
  Timer,
  Trash2,
} from "lucide-react";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

type TabKey = "stack" | "queue" | "deque" | "pq" | "list" | "bst" | "graph";

const TABS: Array<{
  key: TabKey;
  label: string;
  icon: typeof Layers;
  role: string;
}> = [
  { key: "stack", label: "Activity", icon: Layers, role: "latest actions" },
  { key: "queue", label: "Requests", icon: ListOrdered, role: "arrival order" },
  {
    key: "deque",
    label: "Dispatch lane",
    icon: ArrowRight,
    role: "urgent dispatch lane",
  },
  { key: "pq", label: "Expiry order", icon: Timer, role: "food that needs pickup first" },
  { key: "list", label: "Delivery route", icon: ArrowRight, role: "current delivery steps" },
  { key: "bst", label: "Donation search", icon: Search, role: "admin record lookup" },
  { key: "graph", label: "Donor network", icon: Network, role: "real donor and NGO links" },
];

const TAB_GUIDES: Record<TabKey, string> = {
  stack: "Recent app actions are stored newest-first, so the latest change is always at the top.",
  queue: "NGO requests keep their arrival order. Admin approval follows the separate dispatch order when urgency requires it.",
  deque: "Admin dispatch lane: move a pending pickup to the front for urgent handling or return it to routine order at the back.",
  pq: "Available donations are automatically ordered by soonest expiry. NGOs can start with the food that needs collecting first.",
  list: "As a delivery advances, the C linked list records its route steps from pickup toward delivery.",
  bst: "The C program indexes donation records so a request can quickly check that a selected donation exists. Admins can inspect a record by food name; its numeric key stays internal.",
  graph: "The live graph connects actual donors, the food hub, and NGOs that requested donations. BFS explores connections layer by layer.",
};

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
  deque: `int deque_push_front(Deque *d, int v) {
  if (d->count >= DEQUE_CAP) return -1;
  d->head = (d->head - 1 + DEQUE_CAP) % DEQUE_CAP;
  d->items[d->head] = v;
  d->count++;
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

type LabSnapshot = {
  donations: Array<{ id: number; title: string; donorName?: string; status: string; expires_in_minutes: number }>;
  requests: Array<{ id: number; status: string; queue_position: number; donation_id: number; donationTitle: string; ngoName: string }>;
  dispatch: Array<{ id: number; donation_id: number; status: string; dispatch_position: number; dispatch_override: number }>;
  history: Array<{ code: number; action: string; stack_depth: number }>;
  bst: { inorder: number[] };
  route: Array<{ value: number; name: string }>;
  graph: { names: string[]; edges: Array<[number, number]> };
};

const API_URL = (import.meta.env.VITE_C_API_URL || "http://localhost:8080").replace(/\/$/, "");

async function loadLiveSnapshot(): Promise<LabSnapshot> {
  const paths = ["/api/donations", "/api/requests", "/api/dispatch", "/api/history", "/api/bst", "/api/route", "/api/graph/bfs?from=0"];
  const responses = await Promise.all(paths.map((path) => fetch(`${API_URL}${path}`)));
  const bad = responses.find((response) => !response.ok);
  if (bad) throw new Error(`C backend returned ${bad.status}`);
  const [donations, requests, dispatch, history, bst, route, graph] = await Promise.all(responses.map((response) => response.json()));
  return { donations, requests, dispatch, history, bst, route, graph } as LabSnapshot;
}

function syncEngine(engine: CEngine, data: LabSnapshot) {
  engine.reset();
  [...data.history].reverse().forEach(({ code }) => engine.stackPush(code));
  data.requests
    .filter((request) => request.status === "PENDING" && request.queue_position >= 0)
    .sort((a, b) => a.queue_position - b.queue_position)
    .forEach(({ id }) => engine.queueEnqueue(id));
  [...data.dispatch]
    .sort((a, b) => a.dispatch_position - b.dispatch_position)
    .forEach(({ id }) => engine.dequePushBack(id));
  data.donations
    .filter((donation) => donation.status === "AVAILABLE")
    .forEach(({ id, expires_in_minutes }) => engine.pqInsert(id, expires_in_minutes));
  data.route.forEach(({ value }) => engine.llPushBack(value));
  data.bst.inorder.forEach((id) => engine.bstInsert(id));
  engine.graphReset(data.graph.names.length);
  data.graph.edges.forEach(([a, b]) => engine.graphAddEdge(a, b));
  engine.clearTrace();
}

function graphPosition(index: number, count: number) {
  const angle = count <= 1 ? 0 : -Math.PI / 2 + (2 * Math.PI * index) / count;
  return { x: 220 + Math.cos(angle) * (count <= 2 ? 105 : 175), y: 105 + Math.sin(angle) * 72 };
}

/* ------------------------------------------------------------------ */
/* small building blocks                                               */
/* ------------------------------------------------------------------ */
function PanelCard({
  title,
  hint,
  badge,
  children,
}: {
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
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function OpRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>
  );
}

function OpButton({
  onClick,
  children,
  tone = "outline",
}: {
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
      <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stack                                                               */
/* ------------------------------------------------------------------ */
function StackPanel({ history }: { history: LabSnapshot["history"] }) {
  return (
    <PanelCard
      title="Recent activity"
      hint="Newest actions appear first. This is the app’s live activity stack."
      badge={<ClayBadge className="bg-[#dbe7f7] text-[#2c4a77]">Latest first</ClayBadge>}
    >
      <div className="clay-inset mt-4 space-y-2 p-3">
        {history.length ? history.slice(0, 10).map((item, i) => <div key={`${item.stack_depth}-${i}`} className="rounded-xl bg-card px-4 py-3 text-sm font-semibold">{item.action}</div>) : <p className="px-2 py-5 text-center text-sm text-muted-foreground">No activity yet. Donations and requests will appear here as they happen.</p>}
      </div>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */
function QueuePanel({ requests }: { requests: LabSnapshot["requests"] }) {
  const items = requests.filter((request) => request.status === "PENDING" && request.queue_position >= 0).sort((a, b) => a.queue_position - b.queue_position);
  return (
    <PanelCard
      title="Requests waiting for pickup"
      hint="Requests stay in the order they arrived. Urgent dispatch order is managed separately by the admin."
      badge={<ClayBadge className="bg-[#fdecc8] text-[#7a5410]">Oldest request first</ClayBadge>}
    >
      <ol className="clay-inset mt-4 space-y-2 p-3">
        {items.length ? items.map((request, i) => <li key={request.id} className="flex items-center gap-3 rounded-xl bg-card px-4 py-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#f4ede2] text-xs font-bold">{i + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{request.donationTitle}</span><span className="block text-xs text-muted-foreground">Requested by {request.ngoName}</span></span>{i === 0 && <ClayBadge className="bg-[#d5ead0] text-[#2f5224]">arrived first</ClayBadge>}</li>) : <li className="px-2 py-5 text-center text-sm text-muted-foreground">No pickup requests are waiting.</li>}
      </ol>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Priority queue (binary heap tree view)                              */
/* ------------------------------------------------------------------ */
function PqPanel({ engine, donationTitles }: { engine: CEngine; donationTitles: Record<number, string> }) {
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
      title="Food to collect soonest"
      hint="The C program keeps the soonest-expiring available food at the top."
      badge={<ClayBadge className="bg-[#fdecc8] text-[#7a5410]">Expiry priority</ClayBadge>}
    >
      <div className="clay-inset mt-5 overflow-x-auto px-4 py-4 clay-scroll">
        {heap.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Heap empty.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full min-w-[420px]"
          >
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
                    {(donationTitles[slot.id] ?? "Food").slice(0, 8)}
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
        <StatChip label="available foods" value={heap.length} />
        <StatChip label="collect first" value={peek ? donationTitles[peek.id] ?? "Food" : "—"} />
        <StatChip label="time left" value={peek ? `${peek.priority} min` : "—"} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Food names appear in the heap; the top item is the next one to collect.</p>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Linked list                                                         */
/* ------------------------------------------------------------------ */
function ListPanel({ engine, route }: { engine: CEngine; route: LabSnapshot["route"] }) {
  const items = engine.llAll();

  return (
    <PanelCard
      title="Delivery route"
      hint="Live delivery steps, shown in the order they happen."
      badge={
        <ClayBadge className="bg-[#d5ead0] text-[#2f5224]">
          Route steps in order
        </ClayBadge>
      }
    >
      <div className="clay-inset mt-5 overflow-x-auto px-4 py-5 clay-scroll">
        <div className="flex min-w-max items-center gap-3">
          {items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No delivery steps recorded yet.
            </p>
          ) : (
            items.map((item, i) => (
              <div key={`${item}-${i}`} className="flex items-center gap-3">
                <div className="min-w-36 rounded-2xl bg-card px-4 py-3 text-center shadow-sm">
                  <p className="text-sm font-extrabold">
                    {route.find((step) => step.value === item)?.name ?? `step ${item}`}
                  </p>
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
              End of route
            </span>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">Each stop links to the next; the last step ends the route.</p>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* BST — tree view                                                     */
/* ------------------------------------------------------------------ */
type MNode = { key: number; left: MNode | null; right: MNode | null };

function mirrorInsert(
  node: MNode | null,
  key: number,
): { root: MNode | null; ok: boolean } {
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

function mirrorDelete(
  node: MNode | null,
  key: number,
): { root: MNode | null; ok: boolean } {
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

function buildMirror(
  ops: Array<{ type: "i" | "d"; key: number }>,
): MNode | null {
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

function BstPanel({
  engine,
  bump,
  seedKey,
  liveKeys,
  donations,
}: {
  engine: CEngine;
  bump: () => void;
  seedKey: number;
  liveKeys: number[];
  donations: LabSnapshot["donations"];
}) {
  const [root, setRoot] = useState<MNode | null>(null);
  const [foundId, setFoundId] = useState<number | null>(null);

  // rebuild the visual mirror whenever the engine (re)seeds the real tree
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRoot(buildMirror(liveKeys.map((key) => ({ type: "i" as const, key }))));
      setFoundId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [seedKey, liveKeys]);

  const { nodes, edges, width, height } = layout(root);
  const inorder = engine.bstInorder();
  const foodName = (id: number) => donations.find((item) => item.id === id)?.title ?? "Food";

  return (
    <PanelCard
      title="Find a donation"
      hint="Choose a food by name. The C program checks its private record index behind the scenes."
      badge={
        <ClayBadge className="bg-[#d5ead0] text-[#2f5224]">
          Admin search
        </ClayBadge>
      }
    >
      <div className="clay-inset mt-5 overflow-x-auto px-4 py-4 clay-scroll">
        {nodes.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No donations to search yet.
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto min-w-[380px]"
            style={{ width: width }}
          >
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
                  fill={n.key === foundId ? "#7fb069" : n.depth === 0 ? "#e9a23b" : "#fcf8f1"}
                  stroke={n.key === foundId ? "#4a7a38" : n.depth === 0 ? "#c07f1d" : "#e7dcc9"}
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
                  {foodName(n.key).slice(0, 6)}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:max-w-xl">
        <StatChip label="foods indexed" value={engine.bstSize()} />
        <StatChip label="search levels" value={engine.bstHeight()} />
        <StatChip
          label="first food"
          value={nodes.length ? foodName(nodes.find((nd) => nd.depth === 0)!.key) : "—"}
        />
        <StatChip label="records" value={inorder.length} />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">The tree keeps donation records in a searchable order.</p>

      <div className="mt-5 space-y-2">
        <p className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">Select a live donation to search the tree</p>
        {donations.length ? donations.map((donation) => (
          <button key={donation.id} className="clay-inset flex w-full flex-wrap items-center gap-3 px-3 py-3 text-left transition hover:-translate-y-0.5" onClick={() => {
            const depth = engine.bstSearch(donation.id);
            setFoundId(depth >= 0 ? donation.id : null);
            if (depth >= 0) toast.success(`${donation.title} found in the C index after ${depth + 1} comparison${depth === 0 ? "" : "s"}`);
            else toast.error("Donation is missing from the C index");
            bump();
          }}>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{donation.title}</span><span className="block text-xs text-muted-foreground">{donation.donorName || "Community donor"} · expires in {donation.expires_in_minutes} min</span></span>
            <span className="rounded-lg bg-white/70 px-2 py-1 text-xs font-bold">Check record →</span>
          </button>
        )) : <p className="rounded-xl bg-[#f4ede2] px-4 py-5 text-sm text-muted-foreground">No donation records to search yet. Add a donation and it will appear here.</p>}
      </div>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Graph                                                               */
/* ------------------------------------------------------------------ */
function GraphPanel({ engine, bump, names }: { engine: CEngine; bump: () => void; names: string[] }) {
  const [start, setStart] = useState("0");
  const [order, setOrder] = useState<Array<{
    nodes: number[];
    mode: string;
  }> | null>(null);

  const n = engine.graphNodeCount();
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (engine.graphHasEdge(i, j)) edges.push([i, j]);

  const run = (mode: "BFS" | "DFS") => {
    const s = Number(start);
    if (!Number.isInteger(s) || s < 0 || s >= n) return;
    const nodes = mode === "BFS" ? engine.graphBfs(s) : engine.graphDfs(s);
    setOrder([{ nodes, mode }]);
    bump();
  };

  const visited = order?.[0]?.nodes ?? [];
  const rankOf = (i: number) => visited.indexOf(i);

  return (
    <PanelCard
      title="Donor and NGO connections"
      hint="See how the live donor, food hub, and NGO records connect."
      badge={<ClayBadge className="bg-[#dbe7f7] text-[#2c4a77]">Connected network</ClayBadge>}
    >
      <div className="clay-inset mt-5 overflow-x-auto px-4 py-4 clay-scroll">
        {n === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No donations yet. Add food to create donor and hub nodes.</p> : <svg viewBox="0 0 440 210" className="h-auto w-full min-w-[420px]">
          {edges.map(([i, j]) => (
            <line
              key={`${i}-${j}`}
              x1={graphPosition(i, n).x}
              y1={graphPosition(i, n).y}
              x2={graphPosition(j, n).x}
              y2={graphPosition(j, n).y}
              stroke="color-mix(in srgb, var(--muted-foreground) 45%, transparent)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
          {names.slice(0, n).map((label, i) => {
            const rank = rankOf(i);
            const active = rank >= 0;
            const point = graphPosition(i, n);
            return (
              <g key={`${label}-${i}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={24}
                  fill={
                    active ? (rank === 0 ? "#7fb069" : "#e9a23b") : "#fcf8f1"
                  }
                  stroke={active ? "#c07f1d" : "#e7dcc9"}
                  strokeWidth="3"
                />
                <text
                  x={point.x}
                  y={point.y + 40}
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
        </svg>}
      </div>

      {order && (
        <div className="clay-inset mt-4 flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-[11px] font-bold text-muted-foreground uppercase">
            {order[0].mode} visit order:
          </span>
          {order[0].nodes.map((node, i) => (
            <span
              key={`${node}-${i}`}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-sm",
                i === 0 ? "clay-tile-sage text-[#2f4a26]" : "bg-card",
              )}
            >
              {names[node]}
            </span>
          ))}
        </div>
      )}

      <OpRow>
        <label className="grid gap-1 text-xs font-bold text-muted-foreground">Start from
          <select value={start} onChange={(event) => setStart(event.target.value)} className="clay-inset h-9 rounded-xl px-3 text-sm text-foreground">
            {names.map((name, index) => <option key={`${name}-${index}`} value={index}>{name}</option>)}
          </select>
        </label>
        <OpButton tone="default" onClick={() => run("BFS")}>Explore nearby first</OpButton>
        <OpButton onClick={() => run("DFS")}>Follow one path</OpButton>
      </OpRow>
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Trace console                                                       */
/* ------------------------------------------------------------------ */
function TraceConsole({
  engine,
  tick,
}: {
  engine: CEngine | null;
  tick: number;
}) {
  const lines = engine ? engine.trace() : [];
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [tick, lines.length]);

  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-[#312c25] shadow-[14px_14px_30px_rgba(75,62,44,0.25)]">
      <div className="flex items-center justify-between px-5 py-3">
        <span className="flex items-center gap-2 text-[11px] font-bold tracking-wide text-[#d9cdb6] uppercase">
          <Server className="size-3.5 text-[#e9a23b]" /> c-backend/ds.c · engine
          trace
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
          <p className="text-[#9a917f]">
            /* run an operation to see the C engine respond */
          </p>
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
  const user = useSession();
  const [params, setParams] = useSearchParams();
  const [tick, setTick] = useState(0);
  const [seedKey, setSeedKey] = useState(0);
  const [live, setLive] = useState<LabSnapshot | null>(null);
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const initialLoadStarted = useRef(false);

  const isAdmin = user?.accountType === "admin";
  const visibleTabs = TABS.filter((item) => isAdmin || (item.key !== "deque" && item.key !== "bst"));
  const rawTab = params.get("tab");
  const tab: TabKey = visibleTabs.some((t) => t.key === rawTab)
    ? (rawTab as TabKey)
    : visibleTabs[0]?.key ?? "stack";
  const setTab = (key: TabKey) => setParams({ tab: key }, { replace: true });
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const syncLive = useCallback(async (showNotice = false) => {
    if (!engine) return;
    setSyncing(true);
    setSyncError("");
    try {
      const snapshot = await loadLiveSnapshot();
      syncEngine(engine, snapshot);
      setLive(snapshot);
      setSyncedAt(new Date());
      setSeedKey((key) => key + 1);
      bump();
      if (showNotice) toast.success("Lab synced with live FoodShare data.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load live FoodShare data.";
      setSyncError(message);
      if (showNotice) toast.error(message);
    } finally {
      setSyncing(false);
    }
  }, [engine, bump]);

  useEffect(() => {
    if (engine && !initialLoadStarted.current) {
      initialLoadStarted.current = true;
      void syncLive();
    }
  }, [engine, syncLive]);

  useEffect(() => {
    if (!engine) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadLiveSnapshot().then((snapshot) => {
        setLive(snapshot);
        setSyncedAt(new Date());
        setSyncError("");
      }).catch((err) => setSyncError(err instanceof Error ? err.message : "Could not refresh live data."));
    };
    const timer = window.setInterval(refresh, 3000);
    window.addEventListener("foodshare:data-changed", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("foodshare:data-changed", refresh);
    };
  }, [engine]);

  const panel = (key: TabKey) => {
    if (!engine) return null;
    if (key === "stack") return <StackPanel history={live?.history ?? []} />;
    const donationTitles = Object.fromEntries((live?.donations ?? []).map((donation) => [donation.id, donation.title]));
    if (key === "queue") return <QueuePanel requests={live?.requests ?? []} />;
    if (key === "deque") return <DequePanel dispatch={live?.dispatch ?? []} requests={live?.requests ?? []} />;
    if (key === "pq") return <PqPanel engine={engine} donationTitles={donationTitles} />;
    if (key === "list") return <ListPanel engine={engine} route={live?.route ?? []} />;
    if (key === "bst")
      return <BstPanel engine={engine} bump={bump} seedKey={seedKey} liveKeys={live?.bst.inorder ?? []} donations={live?.donations ?? []} />;
    return <GraphPanel engine={engine} bump={bump} names={live?.graph.names ?? []} />;
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <PageHeader
          title="C Engine Lab"
          subtitle="Live donations, pickup requests and delivery records, organized by the C program. Choose a section to see how the app uses them."
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
                  ? "Ready"
                  : status === "loading"
                    ? "Starting…"
                    : "Unavailable"}
              </ClayBadge>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 font-bold"
                onClick={() => void syncLive(true)}
                disabled={!engine || syncing}
              >
                <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} /> Sync live data
              </Button>
            </div>
          }
        />

        {status === "error" && (
          <div className="clay mt-5 flex items-start gap-3 border-l-4 border-[#d96c5f] p-5">
            <Trash2 className="mt-0.5 size-4 shrink-0 text-[#d96c5f]" />
            <div>
              <p className="text-sm font-extrabold">
                Could not start the C engine
              </p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        <section className="clay mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-extrabold">Live FoodShare data</p>
            <p className="text-xs text-muted-foreground">
              {syncError ? `Could not connect to ${API_URL}: ${syncError}` : live
                ? `${live.donations.length} donations · ${live.requests.filter((row) => row.status === "PENDING").length} pending requests · synced ${syncedAt?.toLocaleTimeString() ?? "just now"}`
                : "Connecting to the C backend…"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/browse">Browse food</Link></Button>
            <Button asChild size="sm"><Link to="/donate">Add donation</Link></Button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_1fr]">
          {/* ------------------------- tab rail ------------------------- */}
          <nav className="clay h-fit p-3">
            <p className="px-3 pt-2 pb-3 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
              Structures in ds.c
            </p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {visibleTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-3 text-left transition-all lg:w-full",
                    tab === t.key ? "clay-inset" : "hover:bg-secondary/70",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-xl",
                      tab === t.key
                        ? "clay-tile-amber text-[#5a3d0c]"
                        : "bg-[#f4ede2] text-muted-foreground",
                    )}
                  >
                    <t.icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">
                      {t.label}
                    </span>
                    <span className="block text-[10px] font-semibold text-muted-foreground">
                      {t.role}
                    </span>
                  </span>
                </button>
              ))}
            </div>

          </nav>

          {/* -------------------------- content -------------------------- */}
          <div className="space-y-6">
            {status === "loading" ? (
              <div className="clay flex min-h-72 flex-col items-center justify-center gap-3 p-10 text-center">
                <RefreshCw className="size-6 animate-spin text-[#c07f1d]" />
                <p className="font-extrabold">Loading live data…</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Getting donations, requests, and delivery information from the C server.
                </p>
              </div>
            ) : (
      <>
                <section className="clay border-l-4 border-[#d8a443] px-4 py-3.5 sm:px-5" aria-live="polite">
                  <p className="text-xs font-extrabold tracking-wide text-[#8b641d] uppercase">What this does with live app data</p>
                  <p className="mt-1.5 text-sm leading-6">{TAB_GUIDES[tab]}</p>
                </section>
                {panel(tab)}
                <details className="clay overflow-hidden">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-bold">Technical details <span className="text-xs font-normal text-muted-foreground">(optional C trace and source)</span></summary>
                  <div className="space-y-4 border-t border-[#e9dfcd] p-4">
                    <pre className="clay-inset overflow-x-auto px-4 py-3 font-mono text-[11px] leading-5 clay-scroll">{SNIPPETS[tab]}</pre>
                    <TraceConsole engine={engine} tick={tick} />
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function DequePanel({ dispatch, requests }: {
  dispatch: LabSnapshot["dispatch"];
  requests: LabSnapshot["requests"];
}) {
  const user = useSession();
  const [busyId, setBusyId] = useState<number | null>(null);
  const isAdmin = user?.accountType === "admin";
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const reorder = async (requestId: number, position: "front" | "back") => {
    setBusyId(requestId);
    try {
      const response = await fetch(`${API_URL}/api/dispatch/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, position, account_type: user?.accountType }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not update dispatch order");
      window.dispatchEvent(new Event("foodshare:data-changed"));
      toast.success(position === "front" ? "Pickup moved to the front" : "Pickup returned to routine order");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update dispatch order");
    } finally {
      setBusyId(null);
    }
  };
  return (
    <PanelCard
      title="Live pickup dispatch order"
      hint={isAdmin
        ? "Urgent pickups go to the front; routine pickups stay at the back. Changes update the shared queue and approval order."
        : "This live view follows the admin’s dispatch order. Urgent pickups are handled first."}
      badge={
        <ClayBadge className="bg-[#dbe7f7] text-[#2c4a77]">
          deque · double-ended queue
        </ClayBadge>
      }
    >
      <div className="clay-inset mt-5 space-y-2 p-3">
        {dispatch.length ? (
          dispatch.map((item, i) => {
            const request = requestById.get(item.id);
            return <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-card px-3 py-3">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-xs font-extrabold", i === 0 ? "clay-tile-amber text-[#5a3d0c]" : "bg-[#f4ede2] text-muted-foreground")}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{request?.donationTitle ?? `Donation #${item.donation_id}`}</p>
                <p className="text-xs text-muted-foreground">{request?.ngoName ?? "NGO"} · {item.status.toLowerCase()}</p>
              </div>
              {i === 0 && <ClayBadge className="bg-[#fdecc8] text-[#7a5410]">next pickup</ClayBadge>}
              {isAdmin && item.status === "PENDING" && <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busyId !== null || i === 0} onClick={() => void reorder(item.id, "front")}>{busyId === item.id ? "Saving…" : "Move to front"}</Button>
                <Button size="sm" variant="outline" disabled={busyId !== null || i === dispatch.length - 1} onClick={() => void reorder(item.id, "back")}>Move to back</Button>
              </div>}
            </div>;
          })
        ) : (
          <p className="px-2 py-5 text-center text-sm text-muted-foreground">No pending pickups. NGO requests will appear here as they arrive.</p>
        )}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Food that expires within two hours is automatically placed in the urgent lane. Admins can adjust individual pending pickups; approval follows this order.</p>
    </PanelCard>
  );
}
