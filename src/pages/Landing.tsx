import { api } from "@/lib/api";
import { AppFooter } from "@/components/AppShell";
import PublicHeader from "@/components/PublicHeader";
import { ClayBadge } from "@/components/ui-clay";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@/lib/c-api";
import { expiryInfo, formatNumber, foodEmoji } from "@/lib/format";
import {
  Activity,
  ArrowRight,
  GitBranch,
  Layers,
  ListOrdered,
  Network,
  Server,
  Timer,
  Truck,
} from "lucide-react";
import { Link, useNavigate } from "react-router";

const STRUCTURES = [
  {
    name: "Stack",
    use: "Recent workflow activity",
    operation: "Last action is shown first",
    icon: Layers,
  },
  {
    name: "Circular queue",
    use: "Pickup requests",
    operation: "Requests are handled FIFO",
    icon: ListOrdered,
  },
  {
    name: "Deque",
    use: "Pickup dispatch",
    operation: "Urgent work can move to either end",
    icon: ArrowRight,
  },
  {
    name: "Priority queue",
    use: "Donation urgency",
    operation: "Soonest expiry is prioritized",
    icon: Timer,
  },
  {
    name: "AVL search tree",
    use: "Donation ID index",
    operation: "Balanced record lookup",
    icon: GitBranch,
  },
  {
    name: "Linked list + graph",
    use: "Delivery and connections",
    operation: "Route steps, BFS and DFS",
    icon: Network,
  },
];

export default function Landing() {
  const stats = useQuery(api.donations.stats);
  const donations = useQuery(api.donations.available);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const openApp = (path: string) => {
    navigate(isAuthenticated ? path : `/auth?returnTo=${encodeURIComponent(path)}`);
  };

  const urgentDonations = (donations ?? []).slice(0, 4);

  return (
    <div className="min-h-screen">
      <PublicHeader />

      <main>
        <section className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 pt-10 pb-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pt-16">
          <div>
            <ClayBadge className="bg-[#dce9d4] text-[#2f4a26]">
              <Server className="size-3.5" /> C-first data structures project
            </ClayBadge>
            <h1 className="mt-5 max-w-2xl text-4xl leading-tight font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              FoodShare runs on <span className="text-[#b87920]">C data structures.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              A small food-donation workflow demonstrating how stacks, queues,
              a priority queue, deque, linked list, balanced BST and graph can
              support real application operations. The C backend does the work;
              this website gives it a simple interface.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button className="clay-btn px-5 py-3 font-extrabold" onClick={() => openApp("/dashboard")}>
                {isAuthenticated ? "Open FoodShare" : "Sign in"}
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="outline" className="px-5 py-3 font-bold" onClick={() => openApp("/ds")}>
                View live operations
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Local demo accounts: donor, NGO and admin · data is held by the running C server.
            </p>
          </div>

          <section className="clay rounded-[2rem] p-5 sm:p-6" aria-labelledby="live-board-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Live from C backend</p>
                <h2 id="live-board-title" className="mt-1 text-lg font-extrabold">Food needing pickup</h2>
              </div>
              <ClayBadge className="bg-[#fdecc8] text-[#7a5410]">
                <Timer className="size-3.5" /> expiry priority
              </ClayBadge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="clay-inset rounded-2xl p-3">
                <p className="text-xs text-muted-foreground">Available donations</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{stats ? formatNumber(stats.availableNow) : "—"}</p>
              </div>
              <div className="clay-inset rounded-2xl p-3">
                <p className="text-xs text-muted-foreground">Pending requests</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{stats ? formatNumber(stats.pendingRequests) : "—"}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {urgentDonations.length ? urgentDonations.map((donation) => {
                const expiry = expiryInfo(donation.expiresAt);
                return (
                  <div key={donation.ref} className="clay-inset flex items-center gap-3 rounded-2xl px-3 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-lg">{foodEmoji(donation.foodType)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{donation.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{donation.quantity} servings · {donation.location}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-muted-foreground">{expiry.label}</span>
                  </div>
                );
              }) : (
                <p className="clay-inset rounded-2xl px-4 py-6 text-center text-sm text-muted-foreground">
                  {donations === undefined
                    ? "Start the C backend to load live donations."
                    : "No available food yet. Sign in as a donor to add a donation."}
                </p>
              )}
            </div>
            <Link to={isAuthenticated ? "/browse" : "/auth?returnTo=%2Fbrowse"} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#9b641a]">
              Browse the food board <ArrowRight className="size-4" />
            </Link>
          </section>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-widest text-[#9b641a] uppercase">Project core</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Each structure has a job in the workflow</h2>
            </div>
            <Link to="/about" className="text-sm font-bold text-muted-foreground hover:text-foreground">
              Project details <ArrowRight className="inline size-4" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STRUCTURES.map(({ name, use, operation, icon: Icon }) => (
              <article key={name} className="clay-soft flex gap-3 p-4">
                <span className="clay-tile-amber grid size-10 shrink-0 place-items-center rounded-xl text-[#5a3d0c]">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold">{name}</h3>
                  <p className="mt-1 text-xs font-semibold">{use}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{operation}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
          <div className="clay grid gap-5 rounded-[2rem] p-5 sm:p-7 md:grid-cols-3">
            <div className="flex gap-3">
              <span className="clay-tile-sage grid size-10 shrink-0 place-items-center rounded-xl text-[#2f4a26]"><Activity className="size-5" /></span>
              <div><h3 className="text-sm font-extrabold">Perform an operation</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Post food or submit a pickup request in the normal app workflow.</p></div>
            </div>
            <div className="flex gap-3">
              <span className="clay-tile-sky grid size-10 shrink-0 place-items-center rounded-xl text-[#274066]"><Server className="size-5" /></span>
              <div><h3 className="text-sm font-extrabold">C processes it</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">The HTTP server validates the action and updates the relevant C structures.</p></div>
            </div>
            <div className="flex gap-3">
              <span className="clay-tile-coral grid size-10 shrink-0 place-items-center rounded-xl text-[#6d2f24]"><Truck className="size-5" /></span>
              <div><h3 className="text-sm font-extrabold">See the result</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">FoodShare screens show the live donations, pickup order and route data.</p></div>
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
