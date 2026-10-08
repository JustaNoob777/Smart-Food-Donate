import { AppFooter } from "@/components/AppShell";
import PublicHeader from "@/components/PublicHeader";
import { ClayBadge } from "@/components/ui-clay";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Cpu,
  Database,
  GitBranch,
  Leaf,
  ListOrdered,
  Network,
  Recycle,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router";

const fadeUp = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const VALUES = [
  {
    icon: Recycle,
    tone: "clay-tile-sage text-[#2f4a26]",
    title: "Reduce food waste",
    body: "Surplus that used to hit the bin now has a four-hour shelf-life mission: get it onto a plate before it expires.",
  },
  {
    icon: Users,
    tone: "clay-tile-amber text-[#5a3d0c]",
    title: "Support communities",
    body: "NGOs and volunteers coordinate through a fair FIFO queue — the oldest request is always served first.",
  },
  {
    icon: Leaf,
    tone: "clay-tile-sky text-[#274066]",
    title: "Build a sustainable future",
    body: "Less waste, lower emissions, fuller tables. Small logistics, measurable impact for SDG 2 · Zero Hunger.",
  },
];

const DS_TABLE = [
  { ds: "Queue (FIFO)", icon: ListOrdered, role: "Keeps pending collection requests in arrival order", op: "queue_enqueue / queue_dequeue" },
  { ds: "Priority queue", icon: Timer, role: "Orders available donations by urgency — soonest expiry first", op: "pq_insert / pq_extract_min" },
  { ds: "Stack (LIFO)", icon: GitBranch, role: "Records recent actions for a last-in-first-out history", op: "stack_push / stack_pop" },
  { ds: "Linked list", icon: Recycle, role: "Stores donor chains and delivery route steps", op: "ll_push_back / ll_delete" },
  { ds: "Binary search tree", icon: Search, role: "Indexes donations by id for fast lookup", op: "bst_insert / bst_search" },
  { ds: "Graph + BFS/DFS", icon: Network, role: "Models donor ↔ hub ↔ NGO connections", op: "graph_bfs / graph_dfs" },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <PublicHeader />

      {/* ------------------------------ hero ------------------------------ */}
      <section className="mx-auto w-full max-w-7xl px-4 pt-12 pb-6 sm:px-6 lg:pt-16">
        <motion.div {...fadeUp} className="clay overflow-hidden rounded-[2.25rem]">
          <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <span className="clay-soft inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold text-muted-foreground">
                <Sparkles className="size-3.5 text-[#c07f1d]" /> About FoodShare
              </span>
              <h1 className="mt-5 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
                A community-based platform connecting food donors with people in need.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                FoodShare was built for <strong>SDG 2 · Zero Hunger</strong> as a data
                structures project with a twist: the backend is written in <strong>C</strong>,
                and every requirement — stacks, queues, priority queues, linked lists,
                binary search trees and graphs — powers a real product flow instead of a
                toy example. Our goal is simple: reduce food waste and make donation
                logistics effortless, so nobody in the neighbourhood goes hungry.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/auth?returnTo=/dashboard?role=donor" className="clay-btn px-5 py-2.5 text-sm font-extrabold">
                  Start donating <ArrowRight className="ml-1 inline size-4" />
                </Link>
                <Link to="/ds" className="clay-btn-ghost px-5 py-2.5 text-sm font-extrabold">
                  Inspect the C engine
                </Link>
              </div>
            </div>

            <div className="grid content-start gap-3">
              {[
                { icon: Server, k: "C backend", v: "ds.c + HTTP server, compiled twice (native + WASM)" },
                { icon: ShieldCheck, k: "Role-checked", v: "Donor · NGO · Admin with server-side ownership rules" },
                { icon: Database, k: "Live records", v: "Donations, requests, activity and counters via the C API" },
                { icon: Cpu, k: "385 assertions", v: "Native test suite covering all six structures" },
              ].map((r) => (
                <div key={r.k} className="clay-inset flex items-center gap-3 px-4 py-3.5">
                  <span className="clay-tile-amber grid size-9 shrink-0 place-items-center rounded-xl text-[#5a3d0c]">
                    <r.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold">{r.k}</p>
                    <p className="truncate text-xs font-semibold text-muted-foreground">{r.v}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ------------------------------ values ---------------------------- */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {VALUES.map((v, i) => (
            <motion.div key={v.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.06 * i }} className="clay p-6">
              <div className={`grid size-12 place-items-center rounded-2xl ${v.tone}`}>
                <v.icon className="size-5" strokeWidth={2.5} />
              </div>
              <h3 className="mt-4 text-lg font-extrabold">{v.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{v.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ------------------------- DS cheat sheet ------------------------- */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <motion.div {...fadeUp} className="clay p-7 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-widest text-[#c07f1d] uppercase">
                Requirement checklist
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                How the data structures are used
              </h2>
            </div>
            <ClayBadge className="bg-[#fdecc8] text-[#7a5410]">
              <Timer className="size-3" /> expiry-first scheduling
            </ClayBadge>
          </div>

          <div className="mt-6 overflow-x-auto clay-scroll">
            <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <th className="rounded-l-2xl bg-[#f4ede2] px-4 py-3">Data structure</th>
                  <th className="bg-[#f4ede2] px-4 py-3">Role in this project</th>
                  <th className="rounded-r-2xl bg-[#f4ede2] px-4 py-3">Example operation</th>
                </tr>
              </thead>
              <tbody>
                {DS_TABLE.map((row) => (
                  <tr key={row.ds} className="align-top">
                    <td className="border-b border-border/70 px-4 py-4">
                      <span className="flex items-center gap-2 font-extrabold">
                        <row.icon className="size-4 text-[#c07f1d]" />
                        {row.ds}
                      </span>
                    </td>
                    <td className="border-b border-border/70 px-4 py-4 text-sm leading-6 text-muted-foreground">
                      {row.role}
                    </td>
                    <td className="border-b border-border/70 px-4 py-4">
                      <code className="rounded-lg bg-[#f4ede2] px-2 py-1 text-xs font-bold text-[#4a7a38]">
                        {row.op}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </section>

      {/* ---------------------------- tech stack -------------------------- */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <motion.div {...fadeUp} className="grid gap-5 md:grid-cols-2">
          <div className="clay p-7">
            <div className="flex items-center gap-2">
              <Server className="size-5 text-[#c07f1d]" />
              <h3 className="text-lg font-extrabold">The C backend</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold">c-backend/ds.c</code>{" "}
              implements every structure from scratch with zero libc calls, so the same
              source compiles into an HTTP server and into{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold">ds.wasm</code> for
              the browser.
            </p>
            <pre className="clay-inset mt-4 overflow-x-auto px-4 py-3.5 font-mono text-[11px] leading-5 text-foreground clay-scroll">
{`$ cd c-backend
$ make test     # 385 checks across 6 structures
$ make run      # API on http://localhost:8080
$ curl localhost:8080/api/donations   # priority-queue order`}
            </pre>
          </div>

          <div className="clay p-7">
            <div className="flex items-center gap-2">
              <GitBranch className="size-5 text-[#4a7a38]" />
              <h3 className="text-lg font-extrabold">The web frontend</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              React + Tailwind (claymorphism) with a native C HTTP server for live records.
              The Browse page orders listings through the compiled C heap, and the DS Lab
              drives the engine directly while printing its own trace log.
            </p>
            <pre className="clay-inset mt-4 overflow-x-auto px-4 py-3.5 font-mono text-[11px] leading-5 text-foreground clay-scroll">
{`GET  /api/donations          -> pq (urgency order)
POST /api/donations          -> bst_insert + pq_insert
GET  /api/requests           -> FIFO queue
POST /api/requests/claim     -> dequeue oldest
GET  /api/history            -> stack (LIFO)
GET  /api/graph/bfs?from=0   -> distribution paths`}
            </pre>
          </div>
        </motion.div>
      </section>

      {/* ------------------------------- CTA ------------------------------ */}
      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <motion.div {...fadeUp} className="clay-tile-sage rounded-[2.25rem] px-7 py-12 text-center">
          <h2 className="mx-auto max-w-xl text-3xl font-extrabold tracking-tight text-[#2f4a26]">
            Ready to move food, not waste?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 font-semibold text-[#3f5c35]">
            Join as a donor, an NGO or an admin — the queue is already waiting for you.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              className="clay-btn px-6 py-3 text-sm font-extrabold"
              onClick={() => navigate("/auth?returnTo=/dashboard?role=donor")}
            >
              Get started free
            </button>
            <button
              className="clay-btn-ghost px-6 py-3 text-sm font-extrabold"
              onClick={() => navigate("/browse")}
            >
              Peek at the board
            </button>
          </div>
        </motion.div>
      </section>

      <AppFooter />
    </div>
  );
}
