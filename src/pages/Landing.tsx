import { api } from "@/convex/_generated/api";
import { AppFooter } from "@/components/AppShell";
import PublicHeader from "@/components/PublicHeader";
import { ClayBadge } from "@/components/ui-clay";
import { useAuth } from "@/hooks/use-auth";
import { expiryInfo, formatNumber, foodEmoji } from "@/lib/format";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Clock,
  Gift,
  HeartHandshake,
  Layers,
  Leaf,
  ListOrdered,
  MapPin,
  Network,
  PackageCheck,
  PieChart,
  Recycle,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Truck,
  Users,
} from "lucide-react";
import { useQuery } from "convex/react";
import { Link, useNavigate } from "react-router";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const FEATURES = [
  {
    icon: HeartHandshake,
    tone: "clay-tile-amber text-[#5a3d0c]",
    title: "Donor registration",
    body: "Restaurants, hostels and shops post surplus food in seconds — category, servings, pickup point and expiry.",
  },
  {
    icon: Search,
    tone: "clay-tile-sage text-[#2f4a26]",
    title: "Browse & search",
    body: "NGOs filter live donations by food, place and urgency, with instant id lookups through a binary search tree.",
  },
  {
    icon: Timer,
    tone: "clay-tile-coral text-[#6d2f24]",
    title: "Expiry-first priority",
    body: "A binary min-heap orders every donation by time-to-expiry, so the food that spoils soonest gets collected first.",
  },
  {
    icon: PackageCheck,
    tone: "clay-tile-sky text-[#274066]",
    title: "Claim & collect",
    body: "Requests flow through a strict FIFO queue — oldest first, no cutting in line — and food moves AVAILABLE → CLAIMED → COLLECTED → DISTRIBUTED.",
  },
  {
    icon: Truck,
    tone: "clay-tile-sage text-[#2f4a26]",
    title: "Delivery tracking",
    body: "Each route is a linked list of steps: received, assigned, picked up, in transit, delivered.",
  },
  {
    icon: PieChart,
    tone: "clay-tile-amber text-[#5a3d0c]",
    title: "Admin & DS visualizer",
    body: "Moderation dashboard plus an interactive lab where the evaluator can push, pop, enqueue and traverse the real C engine.",
  },
];

const STRUCTURES = [
  { icon: Layers, name: "Stack", role: "Recent actions history (LIFO)", c: "stack_push / stack_pop" },
  { icon: ListOrdered, name: "Queue", role: "Pending requests in arrival order", c: "queue_enqueue / queue_dequeue" },
  { icon: Activity, name: "Priority queue", role: "Donations ordered by expiry", c: "pq_insert / pq_extract_min" },
  { icon: Recycle, name: "Linked list", role: "Delivery route steps", c: "ll_push_back / ll_delete" },
  { icon: Search, name: "Binary search tree", role: "Donation lookup by id", c: "bst_insert / bst_search" },
  { icon: Network, name: "Graph", role: "Donor ↔ hub ↔ NGO network", c: "graph_bfs / graph_dfs" },
];

const STEPS = [
  { n: "1", title: "Donor posts food", body: "A restaurant adds a donation with quantity, pickup point and expiry time." },
  { n: "2", title: "System prioritizes", body: "The priority queue sorts it by urgency; the BST indexes its id for instant search." },
  { n: "3", title: "NGO claims it", body: "Requests are enqueued FIFO and served oldest-first; the donation flips to CLAIMED." },
  { n: "4", title: "Volunteer delivers", body: "The linked-list route advances step by step until food reaches a plate." },
];

function HeroQueue() {
  const donations = useQuery(api.donations.available);

  const rows = (donations ?? []).slice(0, 4);
  const maxMinutes = Math.max(...rows.map((d) => expiryInfo(d.expiresAt).minutesLeft), 1);

  return (
    <div className="clay relative rounded-[2rem] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Live urgency board
          </p>
          <p className="mt-1 text-lg font-extrabold">Pickups sorted by expiry</p>
        </div>
        <ClayBadge className="bg-[#fdecc8] text-[#7a5410]">
          <Sparkles className="size-3" /> C min-heap
        </ClayBadge>
      </div>

      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <div className="clay-inset px-4 py-6 text-center text-sm text-muted-foreground">
            Loading today&apos;s donations…
          </div>
        ) : (
          rows.map((d, i) => {
            const info = expiryInfo(d.expiresAt);
            const pct = Math.max(8, Math.round((info.minutesLeft / maxMinutes) * 100));
            return (
              <motion.div
                key={d.ref}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 * i, duration: 0.4 }}
                className="clay-inset flex items-center gap-3 px-3.5 py-3"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-card text-xl shadow-sm">
                  {foodEmoji(d.foodType)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-bold">{d.title}</p>
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums">
                      {d.quantity} servings
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-card shadow-inner">
                    <div
                      className={info.urgent ? "h-full rounded-full bg-[#e08a7b]" : "h-full rounded-full bg-[#7fb069]"}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                    {info.label} · {d.location}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>pop() → the most urgent donation next</span>
        <span className="tabular-nums">heap size = {donations?.length ?? 0}</span>
      </div>

      {/* floating clay crumbs */}
      <span className="clay-tile-sage absolute -top-5 -left-4 grid size-12 place-items-center text-xl shadow-lg">🥦</span>
      <span className="clay-tile-amber absolute -right-4 -bottom-4 grid size-12 place-items-center text-xl shadow-lg">🍞</span>
    </div>
  );
}

export default function Landing() {
  const stats = useQuery(api.donations.stats);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const statBand = [
    { label: "Total donations", value: stats?.totalDonations ?? 248, icon: Gift, tone: "clay-tile-amber text-[#5a3d0c]" },
    { label: "People fed", value: stats?.peopleFed ?? 1230, icon: Users, tone: "clay-tile-sage text-[#2f4a26]" },
    { label: "Active NGOs", value: stats?.activeNgos ?? 56, icon: HeartHandshake, tone: "clay-tile-sky text-[#274066]" },
    { label: "Pending requests", value: stats?.pendingRequests ?? 18, icon: Clock, tone: "clay-tile-coral text-[#6d2f24]" },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="min-h-screen">
      <PublicHeader />

      {/* ------------------------------- HERO ------------------------------- */}
      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pt-12 pb-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <span className="clay-soft inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-muted-foreground">
            <Leaf className="size-3.5 text-[#4a7a38]" />
            SDG 2 · Zero Hunger · Data Structures Project
          </span>

          <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Good food reaches
            <br />
            <span className="text-[#c07f1d]">the right people.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            FoodShare connects restaurants, hostels and shops with NGOs and volunteers
            who redistribute surplus meals. A C backend drives every request through
            stacks, queues, priority queues, linked lists, BSTs and graphs — so nothing
            edible is ever left behind.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              className="clay-btn px-6 py-3 text-sm font-extrabold"
              onClick={() => navigate(isAuthenticated ? "/donate" : "/auth?returnTo=/dashboard?role=donor")}
            >
              Donate food
              <ArrowRight className="ml-1 inline size-4" />
            </button>
            <button
              className="clay-btn-ghost px-6 py-3 text-sm font-extrabold"
              onClick={() => navigate(isAuthenticated ? "/browse" : "/auth?returnTo=/dashboard?role=ngo")}
            >
              Request food
            </button>
            <Link to="/ds" className="px-2 text-sm font-bold text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground">
              open the DS lab →
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-[#4a7a38]" /> Role-checked mutations
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Timer className="size-4 text-[#c07f1d]" /> Expiry-first scheduling
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Network className="size-4 text-[#3f6fae]" /> BFS distribution matching
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
        >
          <HeroQueue />
        </motion.div>
      </section>

      {/* ------------------------------ STATS ------------------------------ */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statBand.map((s, i) => (
            <motion.div
              key={s.label}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.06 * i }}
              className="clay-soft flex items-center gap-4 p-5"
            >
              <div className={`grid size-12 shrink-0 place-items-center rounded-2xl ${s.tone}`}>
                <s.icon className="size-5" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-2xl font-extrabold tabular-nums">{formatNumber(s.value)}</p>
                <p className="text-xs font-bold text-muted-foreground">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ----------------------------- FEATURES ---------------------------- */}
      <section id="features" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="text-xs font-bold tracking-widest text-[#c07f1d] uppercase">What it does</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Everything a food-sharing network needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            From a donor&apos;s first click to a recipient&apos;s plate — with the data
            structures doing the heavy lifting behind each step.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.05 * i }}
              className="clay group p-6 transition-transform duration-200 hover:-translate-y-1.5"
            >
              <div className={`grid size-12 place-items-center rounded-2xl ${f.tone}`}>
                <f.icon className="size-5" strokeWidth={2.5} />
              </div>
              <h3 className="mt-4 text-lg font-extrabold">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ------------------------ DATA STRUCTURES -------------------------- */}
      <section id="ds" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <motion.div {...fadeUp} className="clay overflow-hidden rounded-[2rem]">
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="text-xs font-bold tracking-widest text-[#c07f1d] uppercase">
                Under the hood
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Six data structures, written in C
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The backend (<code className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold">c-backend/ds.c</code>)
                implements every structure from scratch with no libc, then compiles the
                same source twice: natively into an HTTP server, and to WebAssembly so the
                browser executes the real C engine.
              </p>
              <Link
                to="/ds"
                className="clay-btn mt-6 inline-flex px-5 py-2.5 text-sm font-extrabold"
              >
                Explore the DS Lab
                <ArrowRight className="size-4" />
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {STRUCTURES.map((s) => (
                <div key={s.name} className="clay-inset p-4">
                  <div className="flex items-center gap-2">
                    <s.icon className="size-4 text-[#c07f1d]" />
                    <p className="text-sm font-extrabold">{s.name}</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{s.role}</p>
                  <code className="mt-2 block truncate text-[11px] font-bold text-[#4a7a38]">{s.c}</code>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* --------------------------- HOW IT WORKS -------------------------- */}
      <section id="how" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="text-xs font-bold tracking-widest text-[#c07f1d] uppercase">Workflow</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
            How a meal finds its way
          </h2>
        </motion.div>

        <div className="mt-8 grid gap-5 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: 0.07 * i }}
              className="clay-soft relative p-6"
            >
              <span className="clay-tile-amber grid size-10 place-items-center rounded-full text-sm font-extrabold text-[#3a2a10]">
                {s.n}
              </span>
              <h3 className="mt-4 font-extrabold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ------------------------------ CTA ------------------------------- */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <motion.div {...fadeUp} className="clay relative overflow-hidden rounded-[2.25rem] px-6 py-12 text-center sm:px-12">
          <div className="absolute -top-10 -left-10 size-40 rounded-full bg-[#e9a23b]/25 blur-2xl" />
          <div className="absolute -right-10 -bottom-12 size-44 rounded-full bg-[#7fb069]/25 blur-2xl" />

          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              Move food, not waste.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Join the network as a donor, an NGO or an admin. It takes one email —
              the queue does the rest.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                className="clay-btn px-6 py-3 text-sm font-extrabold"
                onClick={() => navigate("/auth?returnTo=/dashboard?role=donor")}
              >
                Start donating
              </button>
              <button
                className="clay-btn-ghost px-6 py-3 text-sm font-extrabold"
                onClick={() => navigate("/auth?returnTo=/dashboard?role=ngo")}
              >
                Join as an NGO
              </button>
            </div>
            <p className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <MapPin className="size-3.5" /> FoodShare · Kozhikode &amp; surroundings
            </p>
          </div>
        </motion.div>
      </section>

      <AppFooter />
    </motion.div>
  );
}
