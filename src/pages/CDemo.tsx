import { AppShell } from "@/components/AppShell";
import { ClayBadge, PageHeader } from "@/components/ui-clay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/session";
import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleDot,
  Clock3,
  PackagePlus,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const API = (import.meta.env.VITE_C_API_URL || "http://localhost:8080").replace(/\/+$/, "");

type Health = {
  engine: string;
  donations: number;
  requests: number;
  structures: {
    stack: number;
    queue: number;
    deque: number;
    priorityQueue: number;
    linked_list: number;
    bst: number;
    graph_nodes: number;
  };
};

type Donation = {
  id: number;
  title: string;
  quantity: number;
  location: string;
  expires_in_minutes: number;
  status: string;
};

type RequestRow = {
  id: number;
  donation_id: number;
  donationTitle: string;
  ngoName: string;
  quantity: number;
  status: string;
  step: number;
  queue_position: number;
};

type DispatchItem = {
  id: number;
  donation_id: number;
  status: string;
};

type HistoryItem = { code: number; action: string; stack_depth: number };
type RouteStep = { step: number; name: string };
type BstNode = { id: number; left: BstNode | null; right: BstNode | null };
type BstState = { size: number; height: number; inorder: number[]; root: BstNode | null };
type Graph = { mode: string; start: number; order: number[]; names: string[]; edges: Array<[number, number]> };
type Snapshot = {
  donations: Donation[];
  requests: RequestRow[];
  dispatch: DispatchItem[];
  history: HistoryItem[];
  bst: BstState;
  route: RouteStep[];
  graph: Graph;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { cache: "no-store" });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${path}`);
  }
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload
      ? String((payload as { error: unknown }).error)
      : `C backend returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

function StructureCard({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="clay min-w-0 rounded-3xl p-5">
      <h2 className="font-extrabold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Cell({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <div className={`clay-inset min-w-20 rounded-xl px-3 py-2 text-center text-xs font-bold ${active ? "ring-2 ring-[#d8a443]" : ""}`}>
      {children}
    </div>
  );
}

function BstBranch({ node }: { node: BstNode }) {
  const hasChildren = node.left !== null || node.right !== null;
  return (
    <div className="flex min-w-40 flex-col items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-[#d8a443] bg-[#fff4dc] text-xs font-extrabold">
        {node.id}
      </span>
      {hasChildren && (
        <div className="mt-2 grid w-full grid-cols-2 gap-2 border-t border-[#d8a443] pt-2">
          <div className="flex justify-center border-r border-[#d8a443] pr-1">
            {node.left ? <BstBranch node={node.left} /> : <span className="text-[10px] text-muted-foreground">L · ∅</span>}
          </div>
          <div className="flex justify-center pl-1">
            {node.right ? <BstBranch node={node.right} /> : <span className="text-[10px] text-muted-foreground">R · ∅</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function GraphDiagram({ graph, visitOrder }: { graph: Graph; visitOrder: number[] }) {
  const centerX = 180;
  const centerY = 108;
  const radius = graph.names.length < 5 ? 58 : 84;
  const points = graph.names.map((_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / graph.names.length;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
  const visited = new Set(visitOrder);

  return (
    <div>
      <svg
        className="mx-auto block h-auto w-full max-w-sm"
        viewBox="0 0 360 220"
        role="img"
        aria-label="Distribution graph. Lines show C graph edges; numbered circles identify nodes."
      >
        {graph.edges.map(([from, to]) => {
          const first = points[from];
          const second = points[to];
          if (!first || !second) return null;
          return (
            <line
              key={`${from}-${to}`}
              x1={first.x}
              y1={first.y}
              x2={second.x}
              y2={second.y}
              stroke="#b98a45"
              strokeWidth="2"
            />
          );
        })}
        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={point.x}
              cy={point.y}
              r="17"
              fill={visited.has(index) ? "#f5c46f" : "#f7f2e8"}
              stroke="#9b641a"
              strokeWidth="2"
            />
            <text
              x={point.x}
              y={point.y + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#382b19"
            >
              {index}
            </text>
          </g>
        ))}
      </svg>
      <div className="grid gap-1 sm:grid-cols-2">
        {graph.names.map((name, index) => (
          <div key={`${index}-${name}`} className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-xs ${visited.has(index) ? "bg-[#fff0d0] font-bold" : ""}`}>
            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-[#9b641a] text-[10px] font-extrabold">{index}</span>
            <span className="truncate">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CDemo() {
  const user = useSession();
  const [health, setHealth] = useState<Health | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [title, setTitle] = useState("");
  const [donorName, setDonorName] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("20");
  const [expiresIn, setExpiresIn] = useState("90");
  const [selectedDonation, setSelectedDonation] = useState("");
  const [requestedQuantity, setRequestedQuantity] = useState("1");
  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState<{ found: boolean; depth: number } | null>(null);
  const [graphMode, setGraphMode] = useState<"bfs" | "dfs">("bfs");
  const [graphOrder, setGraphOrder] = useState<number[]>([]);
  const [graphStart, setGraphStart] = useState("0");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextHealth, donations, requests, dispatch, history, bst, route, graph] = await Promise.all([
        getJson<Health>("/api/health"),
        getJson<Donation[]>("/api/donations"),
        getJson<RequestRow[]>("/api/requests"),
        getJson<DispatchItem[]>("/api/dispatch"),
        getJson<HistoryItem[]>("/api/history"),
        getJson<BstState>("/api/bst"),
        getJson<RouteStep[]>("/api/route"),
        getJson<Graph>("/api/graph/bfs?from=0"),
      ]);
      setHealth(nextHealth);
      setSnapshot({ donations, requests, dispatch, history, bst, route, graph });
      setSelectedDonation((current) => donations.some((item) => String(item.id) === current && item.status === "AVAILABLE")
        ? current
        : String(donations.find((item) => item.status === "AVAILABLE")?.id ?? ""));
      setUpdatedAt(new Date());
      setError("");
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Could not load the C backend data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const send = async (path: string, body: Record<string, string | number>) => {
    setBusy(true);
    try {
      const response = await fetch(`${API}${path}`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload
          ? String((payload as { error: unknown }).error)
          : `C backend returned HTTP ${response.status}`;
        throw new Error(message);
      }
      setError("");
      toast.success("Updated by the C backend.");
      await refresh();
      window.dispatchEvent(new Event("foodshare:data-changed"));
      return payload;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Could not reach the C backend.";
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const addDonation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !location.trim()) return;
    void send("/api/donations", {
      title: title.trim(),
      location: location.trim(),
      quantity: Number(quantity),
      expires_in: Number(expiresIn),
      donor_id: user?._id ?? "demo-donor",
      donor_name: donorName.trim() || user?.organization || user?.name || "Community donor",
    }).then((result) => {
      if (result) {
        const created = result as { id?: number };
        setTitle("");
        setLocation("");
        if (created.id) setSearchId(String(created.id));
      }
    });
  };

  const createRequest = () => {
    const donation = snapshot?.donations.find((item) => String(item.id) === selectedDonation);
    if (!donation) return;
    void send("/api/requests", {
      donation_id: donation.id,
      ngo_id: 1,
      quantity: Number(requestedQuantity),
      ngo_ref: user?._id ?? "demo-ngo",
      ngo_name: user?.organization || user?.name || "Community NGO",
      account_type: user?.accountType ?? "guest",
    });
  };

  const searchBst = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = Number(searchId);
    if (!Number.isInteger(id) || id <= 0) return;
    setBusy(true);
    void getJson<{ id: number; found: boolean; depth: number }>(`/api/bst/search?id=${id}`)
      .then((result) => {
        setSearchResult(result);
        setError("");
      })
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "BST search failed."))
      .finally(() => setBusy(false));
  };

  const traverseGraph = (mode: "bfs" | "dfs") => {
    const start = Number(graphStart);
    if (!snapshot || !Number.isInteger(start) || start < 0 || start >= snapshot.graph.names.length) return;
    setBusy(true);
    void getJson<Graph>(`/api/graph/${mode}?from=${start}`)
      .then((result) => {
        setGraphMode(mode);
        setGraphOrder(result.order);
        setError("");
      })
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "Graph traversal failed."))
      .finally(() => setBusy(false));
  };

  const requests = snapshot?.requests ?? [];
  const pending = requests
    .filter((request) => request.queue_position >= 0)
    .sort((a, b) => a.queue_position - b.queue_position);
  const donations = snapshot?.donations ?? [];
  const availableDonations = donations.filter((donation) => donation.status === "AVAILABLE");
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const currentRole = user?.accountType;
  const canRequest = currentRole === "ngo" || currentRole === "admin";
  const canAdmin = currentRole === "admin";
  const graphNames = snapshot?.graph.names ?? [];
  const shownGraphOrder = graphOrder.length ? graphOrder : snapshot?.graph.order ?? [];
  const shownGraphMode = graphOrder.length ? graphMode : snapshot?.graph.mode ?? graphMode;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <PageHeader
          title="FoodShare data structures"
          subtitle="Add food or request a pickup, then see the live C structures update."
          action={
            <div className="flex items-center gap-2">
              <ClayBadge className={health?.engine === "c" ? "bg-[#d5ead0] text-[#2f5224]" : "bg-[#fadbd5] text-[#8a382b]"}>
                <CircleDot className="size-3" /> {loading ? "Loading" : health?.engine === "c" ? "C API connected" : "API offline"}
              </ClayBadge>
              <Button variant="outline" size="icon" aria-label="Refresh data structures" disabled={loading || busy} onClick={() => void refresh()}>
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />

        {error && (
          <div role="alert" className="clay mt-5 border-l-4 border-[#d96c5f] p-4 text-sm">
            <p className="font-bold">{error}</p>
            <p className="mt-1 text-xs text-muted-foreground">Check that the C server is running with <code>make api</code>.</p>
          </div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="clay rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-extrabold"><PackagePlus className="size-4" /> Add a food donation</h2>
            <form onSubmit={addDonation} className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold sm:col-span-2">Food
                <Input className="mt-1.5" required maxLength={63} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Vegetable meals" />
              </label>
              <label className="text-xs font-bold sm:col-span-2">Donor or business name
                <Input
                  className="mt-1.5"
                  maxLength={63}
                  value={donorName}
                  onChange={(event) => setDonorName(event.target.value)}
                  placeholder={user?.organization || "e.g. Sunrise Hotel"}
                  aria-describedby="donor-name-help"
                />
                <span id="donor-name-help" className="mt-1 block font-normal text-muted-foreground">This name appears as the donor in the distribution graph.</span>
              </label>
              <label className="text-xs font-bold">Pickup location
                <Input className="mt-1.5" required maxLength={47} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Community kitchen" />
              </label>
              <label className="text-xs font-bold">Servings
                <Input className="mt-1.5" type="number" min="1" max="1000000" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
              </label>
              <label className="text-xs font-bold">Expires in (minutes)
                <Input className="mt-1.5" type="number" min="1" max="10080" value={expiresIn} onChange={(event) => setExpiresIn(event.target.value)} required />
              </label>
              <div className="flex items-end"><Button className="w-full" type="submit" disabled={busy || !health}>Add donation</Button></div>
            </form>
          </section>

          <section className="clay rounded-3xl p-5">
            <h2 className="flex items-center gap-2 font-extrabold"><Truck className="size-4" /> Request a pickup</h2>
            <label className="mt-3 block text-xs font-bold">Available donation
              <select className="clay-inset mt-1.5 h-10 w-full rounded-xl px-3 text-sm" value={selectedDonation} onChange={(event) => setSelectedDonation(event.target.value)} disabled={!availableDonations.length}>
                {availableDonations.length
                  ? availableDonations.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.title} · {item.quantity} servings</option>)
                  : <option value="">No available donations</option>}
              </select>
            </label>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="min-w-32 flex-1 text-xs font-bold">Servings
                <Input className="mt-1.5" type="number" min="1" value={requestedQuantity} onChange={(event) => setRequestedQuantity(event.target.value)} />
              </label>
              <Button onClick={createRequest} disabled={busy || !health || !canRequest || !selectedDonation}>Request pickup</Button>
            </div>
            {!canRequest && <p className="mt-3 text-xs text-muted-foreground">Sign in with the NGO or admin demo account to request a pickup. <Link className="font-bold underline" to="/auth?returnTo=%2Fc-demo">Sign in</Link></p>}
          </section>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <StructureCard title="Stack · recent actions" note="LIFO · TOP is the next item to pop">
            {snapshot?.history.length ? (
              <div className="mx-auto flex max-w-52 flex-col items-center gap-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#9b641a]">TOP</span>
                {snapshot.history.slice(0, 6).map((item, index) => <Cell key={`${item.stack_depth}-${item.code}`} active={index === 0}>{item.action}</Cell>)}
                <span className="mt-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">BOTTOM</span>
              </div>
            ) : <p className="text-sm text-muted-foreground">Add a donation or request a pickup to push an action.</p>}
            <p className="mt-3 text-center text-[10px] text-muted-foreground">{health?.structures.stack ?? 0} items</p>
          </StructureCard>

          <StructureCard title="Queue · pickup requests" note="FIFO · FRONT leaves first, new requests join the REAR">
            {pending.length ? (
              <div className="overflow-x-auto pb-2">
                <div className="flex w-max items-center gap-2">
                  <span className="text-[10px] font-extrabold text-[#9b641a]">FRONT</span>
                  {pending.map((item, index) => <Cell key={item.id} active={index === 0}>#{item.id}<br />{item.donationTitle}</Cell>)}
                  <span className="text-[10px] font-extrabold text-muted-foreground">REAR</span>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">No pending requests. Submit a pickup request above.</p>}
            <p className="mt-3 text-[10px] text-muted-foreground">{health?.structures.queue ?? 0} waiting in FIFO order</p>
          </StructureCard>

          <StructureCard title="Deque · dispatch" note="Double-ended queue · urgent end at FRONT, routine end at BACK">
            {snapshot?.dispatch.length ? (
              <div className="overflow-x-auto pb-2">
                <div className="flex w-max items-center gap-2">
                  <span className="text-[10px] font-extrabold text-[#9b641a]">FRONT</span>
                  {snapshot.dispatch.map((item, index) => {
                    const request = requestById.get(item.id);
                    return (
                      <div key={item.id} className="clay-inset w-36 rounded-xl p-2 text-center">
                        <p className="text-xs font-bold">#{item.id} · {request?.donationTitle ?? `Food #${item.donation_id}`}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{item.status}</p>
                        {canAdmin && item.status === "PENDING" && (
                          <div className="mt-2 flex justify-center gap-1">
                            <Button size="sm" variant="outline" disabled={busy || index === 0} onClick={() => void send("/api/dispatch/reorder", { request_id: item.id, position: "front", account_type: "admin" })}>To front</Button>
                            <Button size="sm" variant="outline" disabled={busy || index === snapshot.dispatch.length - 1} onClick={() => void send("/api/dispatch/reorder", { request_id: item.id, position: "back", account_type: "admin" })}>To back</Button>
                            {index === 0 && <Button size="sm" disabled={busy} onClick={() => void send("/api/requests/approve", { ref: item.id, account_type: "admin" })}>Approve</Button>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <span className="text-[10px] font-extrabold text-muted-foreground">BACK</span>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Dispatch fills when there are pending pickup requests.</p>}
            {!canAdmin && <p className="mt-3 text-[10px] text-muted-foreground">Admin sign-in enables moving and approving the front item.</p>}
          </StructureCard>

          <StructureCard title="Priority queue · donations" note="Min-heap · donation expiring soonest is highest priority">
            {availableDonations.length ? (
              <div className="overflow-x-auto pb-2">
                <div className="flex w-max items-center gap-2">
                  <span className="text-[10px] font-extrabold text-[#9b641a]">NEXT</span>
                  {availableDonations.map((item, index) => (
                    <Cell key={item.id} active={index === 0}>#{item.id} · {item.title}<br />{item.expires_in_minutes} min</Cell>
                  ))}
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Available donations appear here by expiry priority.</p>}
            <p className="mt-3 text-[10px] text-muted-foreground">{health?.structures.priorityQueue ?? 0} available donations</p>
          </StructureCard>

          <StructureCard title="BST · donation ID lookup" note="Each node shows its real left and right child from the C tree">
            {snapshot?.bst.root ? (
              <div className="overflow-x-auto pb-3">
                <div className="flex min-w-max justify-center px-2"><BstBranch node={snapshot.bst.root} /></div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Add a donation to insert its ID into the tree.</p>}
            <form onSubmit={searchBst} className="mt-3 flex gap-2">
              <Input aria-label="Donation ID to search in BST" type="number" min="1" value={searchId} onChange={(event) => setSearchId(event.target.value)} placeholder="Donation ID" required />
              <Button type="submit" variant="outline" disabled={busy}><Search className="size-4" /> Find</Button>
            </form>
            {searchResult && (
              <p className="mt-2 flex items-center gap-2 text-xs">
                {searchResult.found ? <Check className="size-4 text-green-700" /> : <CircleDot className="size-4 text-muted-foreground" />}
                {searchResult.found ? `Found at depth ${searchResult.depth}.` : "ID not found in the BST."}
              </p>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">Size: {snapshot?.bst.size ?? 0} · Height: {snapshot?.bst.height ?? -1}</p>
          </StructureCard>

          <StructureCard title="Linked list · delivery route" note="HEAD points to the first step; each arrow follows next">
            {snapshot?.route.length ? (
              <div className="overflow-x-auto pb-2">
                <div className="flex w-max items-center gap-2">
                  <span className="text-[10px] font-extrabold text-[#9b641a]">HEAD</span>
                  {snapshot.route.map((step, index) => (
                    <div key={step.step} className="flex items-center gap-2">
                      <Cell>{step.name}</Cell>
                      {index < snapshot.route.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}
                    </div>
                  ))}
                  <span className="text-[10px] font-extrabold text-muted-foreground">NULL</span>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">The route list is empty.</p>}
            {requests.some((request) => request.status !== "DELIVERED") && (
              <div className="mt-4 space-y-2 border-t border-border pt-3">
                {requests.filter((request) => request.status !== "DELIVERED").map((request) => (
                  <div key={request.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate"><strong>{request.donationTitle}</strong> · {request.status} · step {request.step}/4</span>
                    {(currentRole === "ngo" || canAdmin) && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void send("/api/requests/advance", { ref: request.id, account_type: currentRole ?? "guest" })}>Advance</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[10px] text-muted-foreground">{health?.structures.linked_list ?? 0} route nodes</p>
          </StructureCard>

          <StructureCard title="Graph · distribution network" note="Circles are C graph nodes; connecting lines are its actual edges.">
            {snapshot?.graph.names.length ? (
              <>
                <GraphDiagram graph={snapshot.graph} visitOrder={shownGraphOrder} />
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <label className="text-xs font-bold" htmlFor="graph-start">Start traversal at
                    <select
                      id="graph-start"
                      className="clay-inset mt-1 block h-10 w-full rounded-xl px-3 text-xs"
                      value={graphStart}
                      onChange={(event) => setGraphStart(event.target.value)}
                    >
                      {graphNames.map((name, index) => <option key={`${name}-${index}`} value={index}>{index} · {name}</option>)}
                    </select>
                  </label>
                  <Button variant="outline" disabled={busy} onClick={() => traverseGraph("bfs")}>Run BFS</Button>
                  <Button variant="outline" disabled={busy} onClick={() => traverseGraph("dfs")}>Run DFS</Button>
                </div>
                {shownGraphOrder.length > 0 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-bold">{shownGraphMode.toUpperCase()} visit order</p>
                    <ol className="flex flex-wrap gap-2">
                      {shownGraphOrder.map((node, index) => (
                        <li key={`${node}-${index}`} className="clay-inset rounded-lg px-2 py-1 text-[11px]">
                          <span className="mr-1 font-extrabold text-[#9b641a]">{index + 1}.</span>
                          {graphNames[node] ?? `Node ${node}`}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            ) : <p className="text-sm text-muted-foreground">Create a donation to add the food hub and donor nodes.</p>}
            <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground"><ArrowDown className="size-3" /> {health?.structures.graph_nodes ?? 0} nodes in C graph</p>
          </StructureCard>
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <Clock3 className="size-3.5" /> {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Waiting for C backend"} · Data resets when the C server restarts.
        </p>
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline"><Link to="/ds">Open FoodShare Operations <ArrowRight className="size-4" /></Link></Button>
        </div>
      </div>
    </AppShell>
  );
}
