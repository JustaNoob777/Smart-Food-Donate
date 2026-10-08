import { AppShell } from "@/components/AppShell";
import { ClayBadge, PageHeader } from "@/components/ui-clay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  Boxes,
  CircleDot,
  Clock3,
  Layers,
  ListOrdered,
  Network,
  PackagePlus,
  RefreshCw,
  Search,
  Timer,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

type SectionKey = "overview" | "stack" | "queue" | "deque" | "pq" | "list" | "bst" | "graph";
type Donation = {
  id: number;
  title: string;
  donorName: string;
  status: string;
  quantity: number;
  location: string;
  expires_in_minutes: number;
};
type Request = {
  id: number;
  donation_id: number;
  donationTitle: string;
  ngoName: string;
  quantity: number;
  status: string;
  queue_position: number;
};
type DispatchItem = {
  id: number;
  donation_id: number;
  status: string;
  dispatch_position: number;
  dispatch_override: number;
};
type HistoryItem = { code: number; action: string; stack_depth: number };
type RouteStep = { value: number; name: string };
type Graph = {
  mode: string;
  start: number;
  order: number[];
  names: string[];
  edges: Array<[number, number]>;
};
type Snapshot = {
  donations: Donation[];
  requests: Request[];
  dispatch: DispatchItem[];
  history: HistoryItem[];
  bst: { size: number; height: number; inorder: number[] };
  route: RouteStep[];
  graph: Graph;
};

const API_URL = (import.meta.env.VITE_C_API_URL || "http://localhost:8080").replace(/\/$/, "");

const SECTIONS: Array<{ key: SectionKey; label: string; detail: string; icon: typeof Boxes }> = [
  { key: "overview", label: "Overview", detail: "Live workflow status", icon: Boxes },
  { key: "stack", label: "Recent activity", detail: "Latest changes", icon: Layers },
  { key: "queue", label: "Pickup requests", detail: "Arrival order", icon: ListOrdered },
  { key: "deque", label: "Dispatch order", detail: "Urgent pickups", icon: ArrowRight },
  { key: "pq", label: "Food urgency", detail: "Soonest expiry", icon: Timer },
  { key: "list", label: "Delivery route", detail: "Current progress", icon: Truck },
  { key: "bst", label: "Donation records", detail: "Search the live index", icon: Search },
  { key: "graph", label: "Distribution network", detail: "Donor and NGO connections", icon: Network },
];

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `C backend returned ${response.status}`);
  return payload as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `C backend returned ${response.status}`);
  return payload as T;
}

async function loadSnapshot(): Promise<Snapshot> {
  const [donations, requests, dispatch, history, bst, route, graph] = await Promise.all([
    getJson<Donation[]>("/api/donations"),
    getJson<Request[]>("/api/requests"),
    getJson<DispatchItem[]>("/api/dispatch"),
    getJson<HistoryItem[]>("/api/history"),
    getJson<Snapshot["bst"]>("/api/bst"),
    getJson<RouteStep[]>("/api/route"),
    getJson<Graph>("/api/graph/bfs?from=0"),
  ]);
  return { donations, requests, dispatch, history, bst, route, graph };
}

function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="clay rounded-3xl p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-extrabold">{title}</h2>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="clay-inset rounded-2xl px-4 py-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <p className="clay-inset rounded-2xl px-4 py-7 text-center text-sm text-muted-foreground">{children}</p>;
}

function DonationList({ donations }: { donations: Donation[] }) {
  if (!donations.length) return <Empty>No food donations yet. Add food to get started.</Empty>;
  return (
    <div className="space-y-2">
      {donations.map((donation) => (
        <article key={donation.id} className="clay-inset flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{donation.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {donation.quantity} servings · {donation.location} · {donation.donorName || "Community donor"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {donation.status === "AVAILABLE" && <span className="text-xs text-muted-foreground">{donation.expires_in_minutes} min left</span>}
            <ClayBadge className={donation.status === "AVAILABLE" ? "bg-[#d5ead0] text-[#2f5224]" : "bg-[#ede3d3] text-[#665c4e]"}>
              {donation.status}
            </ClayBadge>
          </div>
        </article>
      ))}
    </div>
  );
}

function RequestList({ requests }: { requests: Request[] }) {
  const pending = requests
    .filter((request) => request.status === "PENDING" && request.queue_position >= 0)
    .sort((a, b) => a.queue_position - b.queue_position);
  if (!pending.length) return <Empty>No pickup requests are waiting.</Empty>;
  return (
    <ol className="space-y-2">
      {pending.map((request, index) => (
        <li key={request.id} className="clay-inset flex items-center gap-3 rounded-2xl px-4 py-3">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl text-xs font-extrabold", index === 0 ? "clay-tile-sage text-[#2f4a26]" : "bg-card")}>{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{request.donationTitle}</span>
            <span className="block text-xs text-muted-foreground">{request.quantity} servings · {request.ngoName}</span>
          </span>
          {index === 0 && <ClayBadge className="bg-[#d5ead0] text-[#2f5224]">oldest</ClayBadge>}
        </li>
      ))}
    </ol>
  );
}

function ActivityList({ history }: { history: HistoryItem[] }) {
  if (!history.length) return <Empty>No activity yet. FoodShare actions will appear here.</Empty>;
  return (
    <ol className="space-y-2">
      {history.slice(0, 10).map((item, index) => (
        <li key={`${item.stack_depth}-${index}`} className="clay-inset flex items-center gap-3 rounded-2xl px-4 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-card text-xs font-extrabold">{index + 1}</span>
          <span className="text-sm font-semibold">{item.action}</span>
        </li>
      ))}
    </ol>
  );
}

function DispatchList({
  dispatch,
  requests,
  accountType,
  onReorder,
  busyId,
}: {
  dispatch: DispatchItem[];
  requests: Request[];
  accountType?: string;
  onReorder: (id: number, position: "front" | "back") => void;
  busyId: number | null;
}) {
  const isAdmin = accountType === "admin";
  const requestById = new Map(requests.map((request) => [request.id, request]));
  if (!dispatch.length) return <Empty>No active pickups to dispatch.</Empty>;
  return (
    <div className="space-y-2">
      {dispatch.map((item, index) => {
        const request = requestById.get(item.id);
        return (
          <div key={item.id} className="clay-inset flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl text-xs font-extrabold", index === 0 ? "clay-tile-amber text-[#5a3d0c]" : "bg-card")}>{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{request?.donationTitle ?? `Donation #${item.donation_id}`}</p>
              <p className="text-xs text-muted-foreground">{request?.ngoName ?? "NGO"} · {item.status.toLowerCase()}</p>
            </div>
            {index === 0 && <ClayBadge className="bg-[#fdecc8] text-[#7a5410]">next pickup</ClayBadge>}
            {isAdmin && item.status === "PENDING" && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busyId !== null || index === 0} onClick={() => onReorder(item.id, "front")}>
                  {busyId === item.id ? "Saving…" : "Move forward"}
                </Button>
                <Button size="sm" variant="outline" disabled={busyId !== null || index === dispatch.length - 1} onClick={() => onReorder(item.id, "back")}>Move back</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GraphView({
  graph,
  traversal,
  onTraverse,
}: {
  graph: Graph;
  traversal: Graph | null;
  onTraverse: (mode: "bfs" | "dfs", start: number) => void;
}) {
  const [start, setStart] = useState(0);
  const count = graph.names.length;
  const points = graph.names.map((_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(count, 1);
    return { x: 220 + Math.cos(angle) * 165, y: 120 + Math.sin(angle) * 88 };
  });
  const order = traversal?.order ?? [];
  return (
    <>
      {count ? (
        <div className="clay-inset overflow-x-auto rounded-2xl p-3">
          <svg viewBox="0 0 440 240" className="mx-auto h-auto w-full min-w-[360px]">
            {graph.edges.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={points[a].x} y1={points[a].y} x2={points[b].x} y2={points[b].y} stroke="#c8bda9" strokeWidth="3" />
            ))}
            {graph.names.map((name, index) => {
              const visitIndex = order.indexOf(index);
              return (
                <g key={`${name}-${index}`}>
                  <circle cx={points[index].x} cy={points[index].y} r="22" fill={visitIndex === 0 ? "#7fb069" : visitIndex > 0 ? "#e9a23b" : "#fcf8f1"} stroke="#d9cdb6" strokeWidth="2" />
                  {visitIndex >= 0 && <text x={points[index].x} y={points[index].y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#3d3831">{visitIndex + 1}</text>}
                  <text x={points[index].x} y={points[index].y + 39} textAnchor="middle" fontSize="10" fontWeight="700" fill="#665c4e">{name}</text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : <Empty>No network connections are available.</Empty>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="network-start">Start from</label>
        <select id="network-start" value={start} onChange={(event) => setStart(Number(event.target.value))} className="clay-inset h-9 rounded-xl px-3 text-sm">
          {graph.names.map((name, index) => <option key={`${name}-${index}`} value={index}>{name}</option>)}
        </select>
        <Button variant="outline" onClick={() => onTraverse("bfs", start)}>Explore nearby</Button>
        <Button variant="outline" onClick={() => onTraverse("dfs", start)}>Follow connections</Button>
      </div>
      {traversal && (
        <p className="mt-4 text-sm font-semibold text-muted-foreground">
          {traversal.order.map((node) => traversal.names[node]).filter(Boolean).join(" → ")}
        </p>
      )}
    </>
  );
}

export default function DSLab() {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [searchDonation, setSearchDonation] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [traversal, setTraversal] = useState<Graph | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await loadSnapshot());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load FoodShare data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 3000);
    window.addEventListener("foodshare:data-changed", refresh);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("foodshare:data-changed", refresh);
    };
  }, [refresh]);

  const requestedSection = params.get("tab") as SectionKey | null;
  const activeSection = requestedSection && SECTIONS.some((item) => item.key === requestedSection)
    ? requestedSection
    : "overview";

  const navigateSection = (section: SectionKey) => {
    setParams(section === "overview" ? {} : { tab: section }, { replace: true });
  };

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      toast.success(message);
      await refresh();
      window.dispatchEvent(new Event("foodshare:data-changed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The C backend operation failed.");
    }
  };

  const reorderDispatch = async (id: number, position: "front" | "back") => {
    setBusyId(id);
    await runAction(
      () => postJson("/api/dispatch/reorder", { request_id: id, position, account_type: session?.accountType }),
      position === "front" ? "Pickup moved forward in the dispatch order." : "Pickup returned to routine order.",
    );
    setBusyId(null);
  };

  const searchBst = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const donation = data?.donations.find((item) => item.title.toLowerCase() === searchDonation.trim().toLowerCase());
    if (!donation) {
      setSearchResult("No donation with that name is on the board.");
      return;
    }
    try {
      const result = await getJson<{ found: boolean; depth: number }>(`/api/bst/search?id=${donation.id}`);
      setSearchResult(result.found
        ? `${donation.title} is indexed in the C BST (depth ${result.depth}).`
        : `${donation.title} is not present in the C BST.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "BST search failed.");
    }
  };

  const traverse = async (mode: "bfs" | "dfs", start: number) => {
    try {
      setTraversal(await getJson<Graph>(`/api/graph/${mode}?from=${start}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network traversal failed.");
    }
  };

  const current = data;
  const available = current?.donations.filter((item) => item.status === "AVAILABLE") ?? [];
  const pending = current?.requests.filter((item) => item.status === "PENDING") ?? [];
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <PageHeader
          title="FoodShare operations"
          subtitle="Live donations, pickups and delivery information managed by the C backend."
          action={
            <div className="flex items-center gap-2">
              <ClayBadge className={cn("px-3 py-1.5", error ? "bg-[#fadbd5] text-[#8a382b]" : "bg-[#d5ead0] text-[#2f5224]")}>
                <CircleDot className="size-3" /> {error ? "Backend unavailable" : loading ? "Connecting…" : "Backend connected"}
              </ClayBadge>
              <Button variant="outline" size="icon" aria-label="Refresh FoodShare data" onClick={() => { setLoading(true); void refresh(); }}>
                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              </Button>
            </div>
          }
        />

        {error && (
          <div role="alert" className="clay mt-5 border-l-4 border-[#d96c5f] p-5">
            <p className="text-sm font-extrabold">FoodShare could not reach the C backend.</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">Start the server in Ubuntu with <code>make api</code>, then refresh.</p>
          </div>
        )}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Available food" value={loading ? "…" : available.length} detail="Expiry order maintained by the C priority queue" />
          <Metric label="Waiting pickups" value={loading ? "…" : pending.length} detail="Requests held in arrival order" />
          <Metric label="Indexed donations" value={loading ? "…" : current?.bst.size ?? 0} detail={`C binary search tree · height ${current?.bst.height ?? "—"}`} />
          <Metric label="Latest actions" value={loading ? "…" : current?.history.length ?? 0} detail="Recent changes stored in the C stack" />
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_1fr]">
          <nav aria-label="FoodShare operations" className="clay h-fit rounded-3xl p-3">
            {SECTIONS.map(({ key, label, detail, icon: Icon }) => (
              <button
                key={key}
                onClick={() => navigateSection(key)}
                aria-current={activeSection === key ? "page" : undefined}
                className={cn("mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition", activeSection === key ? "clay-inset" : "hover:bg-card")}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", activeSection === key ? "clay-tile-amber text-[#5a3d0c]" : "bg-[#f4ede2] text-muted-foreground")}><Icon className="size-4" /></span>
                <span><span className="block text-sm font-extrabold">{label}</span><span className="block text-[10px] font-semibold text-muted-foreground">{detail}</span></span>
              </button>
            ))}
          </nav>

          <div className="space-y-5">
            {activeSection === "overview" && (
              <>
                <Panel title="FoodShare at a glance" description="The C structures support the regular donation and pickup workflow.">
                  <div className="mb-5 flex flex-wrap gap-2">
                    <Button asChild><Link to="/donate"><PackagePlus className="size-4" /> Add food</Link></Button>
                    <Button asChild variant="outline"><Link to="/browse">Browse donations <ArrowRight className="size-4" /></Link></Button>
                    {session?.accountType === "admin" && <Button asChild variant="outline"><Link to="/dashboard">Review requests</Link></Button>}
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    <div>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold"><Timer className="size-4 text-[#c07f1d]" /> Food needing pickup</h3>
                      <DonationList donations={available.slice(0, 4)} />
                    </div>
                    <div>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold"><ListOrdered className="size-4 text-[#c07f1d]" /> Pickup requests</h3>
                      <RequestList requests={current?.requests ?? []} />
                    </div>
                  </div>
                </Panel>
                <Panel title="Recent activity" description="A short view of the latest changes recorded by FoodShare." action={<Button variant="ghost" size="sm" onClick={() => navigateSection("stack")}>View all</Button>}>
                  <ActivityList history={(current?.history ?? []).slice(0, 4)} />
                </Panel>
              </>
            )}

            {activeSection === "stack" && (
              <Panel title="Recent activity" description="Donation, request and delivery changes in the order they happened.">
                <ActivityList history={current?.history ?? []} />
              </Panel>
            )}

            {activeSection === "queue" && (
              <Panel title="Pickup requests" description="Requests retain arrival order. The oldest pending pickup appears first." action={<Button asChild size="sm"><Link to="/browse">Browse food</Link></Button>}>
                <RequestList requests={current?.requests ?? []} />
              </Panel>
            )}

            {activeSection === "deque" && (
              <Panel title="Pickup dispatch" description={session?.accountType === "admin" ? "Adjust which pending pickup is handled next." : "Dispatch priority for current pickups."}>
                <DispatchList dispatch={current?.dispatch ?? []} requests={current?.requests ?? []} accountType={session?.accountType} onReorder={(id, position) => void reorderDispatch(id, position)} busyId={busyId} />
              </Panel>
            )}

            {activeSection === "pq" && (
              <Panel title="Food needing pickup" description="Available donations are listed soonest-expiring first by the C priority queue." action={<Button asChild size="sm"><Link to="/donate">Add food</Link></Button>}>
                <DonationList donations={available} />
              </Panel>
            )}

            {activeSection === "list" && (
              <Panel title="Delivery progress" description="The linked list holds the current route steps in order." action={<Button asChild variant="outline" size="sm"><Link to="/track">Open tracking</Link></Button>}>
                {current?.route.length ? (
                  <ol className="flex flex-wrap items-center gap-2">
                    {current.route.map((step, index) => (
                      <li key={`${step.value}-${index}`} className="flex items-center gap-2">
                        <span className={cn("rounded-2xl px-4 py-3 text-sm font-bold", index === 0 ? "clay-tile-sage text-[#2f4a26]" : "clay-inset")}>{step.name}</span>
                        {index < current.route.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}
                      </li>
                    ))}
                    <li className="font-mono text-xs text-muted-foreground">End</li>
                  </ol>
                ) : <Empty>No active delivery route. Route steps appear as pickups progress.</Empty>}
              </Panel>
            )}

            {activeSection === "bst" && (
              <Panel title="Donation records" description="Search food by name; the C backend looks up the selected record in its binary search tree.">
                <div className="mb-5 grid gap-3 sm:grid-cols-3">
                  <Metric label="Indexed records" value={current?.bst.size ?? 0} detail="Donation IDs in C" />
                  <Metric label="Tree height" value={current?.bst.height ?? -1} detail="Longest path from root" />
                  <Metric label="Sorted IDs" value={current?.bst.inorder.length ?? 0} detail="In-order traversal count" />
                </div>
                <form onSubmit={searchBst} className="flex max-w-xl gap-2">
                  <label className="sr-only" htmlFor="donation-search">Food name</label>
                  <Input id="donation-search" list="food-records" value={searchDonation} onChange={(event) => setSearchDonation(event.target.value)} placeholder="Search food name" required />
                  <datalist id="food-records">{current?.donations.map((item) => <option key={item.id} value={item.title} />)}</datalist>
                  <Button type="submit" variant="outline"><Search className="size-4" /> Find</Button>
                </form>
                {searchResult && <p role="status" className="mt-3 text-sm font-semibold">{searchResult}</p>}
                <p className="mt-5 text-xs text-muted-foreground">Donation IDs indexed: {(current?.bst.inorder ?? []).join(", ") || "none yet"}</p>
              </Panel>
            )}

            {activeSection === "graph" && (
              <Panel title="Distribution network" description="The C graph connects donors, hubs and recipient organizations.">
                {current && <GraphView graph={current.graph} traversal={traversal} onTraverse={(mode, start) => void traverse(mode, start)} />}
              </Panel>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><Activity className="size-3.5" /> Live data from the C backend</span>
              <span className="flex items-center gap-2"><Clock3 className="size-3.5" /> Updated automatically</span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
