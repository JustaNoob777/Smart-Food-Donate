import { api } from "@/convex/_generated/api";
import { AppShell, roleLabel } from "@/components/AppShell";
import { ClayBadge, PageHeader, StatCard } from "@/components/ui-clay";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useEnsureSeed } from "@/hooks/use-seed";
import { cn } from "@/lib/utils";
import { expiryInfo, foodEmoji, formatNumber, statusClass, timeAgo } from "@/lib/format";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Clock,
  Cog,
  Gift,
  HeartHandshake,
  Inbox,
  Layers,
  LayoutDashboard,
  ListOrdered,
  MapPin,
  Network,
  PackageCheck,
  PieChart,
  Plus,
  Search,
  Send,
  Timer,
  Truck,
  Users,
} from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

type AccountType = "donor" | "ngo" | "admin";
const ACCOUNT_TYPES: AccountType[] = ["donor", "ngo", "admin"];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ------------------------------------------------------------------ */
/* Role picker shown until the account has picked an experience        */
/* ------------------------------------------------------------------ */
function RolePicker({ onPick, busy }: { onPick: (t: AccountType) => void; busy: boolean }) {
  const cards: Array<{
    type: AccountType;
    icon: typeof Users;
    title: string;
    body: string;
    tone: string;
  }> = [
    {
      type: "donor",
      icon: Gift,
      title: "I'm a donor",
      body: "Restaurants, hostels and shops posting surplus food.",
      tone: "clay-tile-amber text-[#5a3d0c]",
    },
    {
      type: "ngo",
      icon: HeartHandshake,
      title: "I'm an NGO",
      body: "Organizations requesting and distributing food to people in need.",
      tone: "clay-tile-sage text-[#2f4a26]",
    },
    {
      type: "admin",
      icon: Cog,
      title: "I'm an admin",
      body: "Oversee the network, approve requests and inspect the data structures.",
      tone: "clay-tile-sky text-[#274066]",
    },
  ];

  return (
    <div className="clay mx-auto max-w-4xl rounded-[2rem] p-7 sm:p-10">
      <div className="text-center">
        <span className="clay-soft inline-flex px-3.5 py-1.5 text-xs font-bold text-muted-foreground">
          One quick step
        </span>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Which role are you trying?</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          FoodShare serves three experiences. Pick one — you can switch any time from
          your profile.
        </p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.type}
            disabled={busy}
            onClick={() => onPick(c.type)}
            className="clay-soft group p-6 text-left transition-transform duration-200 hover:-translate-y-1.5 disabled:opacity-60"
          >
            <div className={cn("grid size-12 place-items-center rounded-2xl", c.tone)}>
              <c.icon className="size-5" strokeWidth={2.5} />
            </div>
            <p className="mt-4 font-extrabold">{c.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{c.body}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#c07f1d]">
              Continue <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */
function ActivityStack({ limit = 6 }: { limit?: number }) {
  const activity = useQuery(api.activity.recent, { limit });
  const rows = activity ?? [];

  return (
    <div className="clay p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayersIcon />
          <h3 className="font-extrabold">Recent actions</h3>
        </div>
        <ClayBadge className="bg-[#dbe7f7] text-[#2c4a77]">stack · LIFO</ClayBadge>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {rows.map((row, i) => (
            <li key={row._id} className="clay-inset flex items-start gap-3 px-3.5 py-3">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-card text-[10px] font-extrabold shadow-sm tabular-nums">
                {rows.length - i}
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-5 font-semibold">{row.text}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {row.actor} · {timeAgo(row.ts)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-[11px] font-semibold text-muted-foreground">
        pop() always returns the newest action first — pushed by the C stack.
      </p>
    </div>
  );
}

function LayersIcon() {
  return (
    <span className="clay-tile-sky grid size-8 place-items-center rounded-xl text-[#274066]">
      <ListOrdered className="size-4" />
    </span>
  );
}

function UrgencyQueue({ title = "Urgency queue" }: { title?: string }) {
  const donations = useQuery(api.donations.available);
  const rows = (donations ?? []).slice(0, 5);
  const max = Math.max(...rows.map((d) => expiryInfo(d.expiresAt).minutesLeft), 1);

  return (
    <div className="clay p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="clay-tile-coral grid size-8 place-items-center rounded-xl text-[#6d2f24]">
            <Timer className="size-4" />
          </span>
          <h3 className="font-extrabold">{title}</h3>
        </div>
        <ClayBadge className="bg-[#fdecc8] text-[#7a5410]">priority queue</ClayBadge>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No food waiting — the heap is empty.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((d) => {
            const info = expiryInfo(d.expiresAt);
            const pct = Math.max(8, Math.round((info.minutesLeft / max) * 100));
            return (
              <div key={d.ref} className="clay-inset px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold">
                    <span className="mr-1.5">{foodEmoji(d.foodType)}</span>
                    {d.title}
                  </p>
                  <span className="shrink-0 text-[11px] font-bold text-muted-foreground tabular-nums">
                    #{d.ref}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-card shadow-inner">
                  <div
                    className={cn("h-full rounded-full", info.urgent ? "bg-[#e08a7b]" : "bg-[#7fb069]")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
                  {info.label} · {d.location} · {d.quantity} servings
                </p>
              </div>
            );
          })}
        </div>
      )}
      <Link to="/browse" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#c07f1d]">
        Open full board <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  to,
  tone,
}: {
  icon: typeof Users;
  label: string;
  to: string;
  tone: string;
}) {
  return (
    <Link
      to={to}
      className="clay-soft group flex items-center gap-3 p-4 transition-transform duration-200 hover:-translate-y-1"
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
        <Icon className="size-4" strokeWidth={2.5} />
      </span>
      <span className="text-sm font-extrabold">{label}</span>
      <ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Donor home                                                          */
/* ------------------------------------------------------------------ */
function DonorHome({ name }: { name: string }) {
  const mine = useQuery(api.donations.mine);
  const donations = mine ?? [];
  const meals = donations.reduce((sum, d) => sum + d.quantity, 0);
  const available = donations.filter((d) => d.status === "AVAILABLE").length;
  const moving = donations.filter((d) => d.status !== "AVAILABLE").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Gift} label="My donations" value={donations.length} tone="amber" />
        <StatCard icon={Users} label="Servings shared" value={formatNumber(meals)} tone="sage" />
        <StatCard icon={PackageCheck} label="Available now" value={available} tone="sky" />
        <StatCard icon={Truck} label="In circulation" value={moving} tone="coral" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="clay p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold">My donations</h3>
              <p className="text-xs text-muted-foreground">
                {name}, here&apos;s everything you&apos;ve posted.
              </p>
            </div>
            <Link
              to="/donate"
              className="clay-btn inline-flex items-center gap-1.5 px-4 py-2 text-sm font-extrabold"
            >
              <Plus className="size-4" /> New donation
            </Link>
          </div>

          {donations.length === 0 ? (
            <div className="clay-inset mt-5 px-5 py-10 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-card text-2xl shadow-sm">
                🍲
              </div>
              <p className="mt-3 font-bold">No donations yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Post your first surplus meal — the priority queue will take it from there.
              </p>
              <Link to="/donate" className="clay-btn mt-4 inline-flex px-5 py-2.5 text-sm font-extrabold">
                Add food donation
              </Link>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {donations.map((d) => {
                const info = expiryInfo(d.expiresAt);
                return (
                  <li key={d.ref} className="clay-inset flex flex-wrap items-center gap-3 px-4 py-3.5">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card text-xl shadow-sm">
                      {foodEmoji(d.foodType)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{d.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] font-semibold text-muted-foreground">
                        <span>#{d.ref}</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {d.location}
                        </span>
                        <span className={cn("inline-flex items-center gap-1", info.urgent && "text-[#b4553f]")}>
                          <Clock className="size-3" /> {info.label}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold tabular-nums">{d.quantity} 🍽</span>
                      <ClayBadge className={statusClass(d.status)}>{d.status}</ClayBadge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <UrgencyQueue title="Food nearing expiry" />
          <ActivityStack />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* NGO home                                                            */
/* ------------------------------------------------------------------ */
function NgoHome({ name }: { name: string }) {
  const requests = useQuery(api.requests.mine);
  const list = requests ?? [];
  const pending = list.filter((r) => r.status === "PENDING").length;
  const approved = list.filter((r) => r.status === "APPROVED").length;
  const delivered = list.filter((r) => r.status === "DELIVERED").length;
  const meals = list.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Inbox} label="Total requests" value={list.length} tone="amber" hint={`${formatNumber(meals)} servings requested`} />
        <StatCard icon={BadgeCheck} label="Approved" value={approved} tone="sage" />
        <StatCard icon={Clock} label="Pending" value={pending} tone="sky" />
        <StatCard icon={Truck} label="Delivered" value={delivered} tone="coral" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="clay p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold">Recent requests</h3>
              <p className="text-xs text-muted-foreground">
                Served strictly FIFO — oldest request first, every time.
              </p>
            </div>
            <ClayBadge className="bg-[#dbe7f7] text-[#2c4a77]">queue · FIFO</ClayBadge>
          </div>

          {list.length === 0 ? (
            <div className="clay-inset mt-5 px-5 py-10 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-card text-2xl shadow-sm">
                🥖
              </div>
              <p className="mt-3 font-bold">No requests yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Welcome, {name}. Browse the board and claim the food your community needs.
              </p>
              <Link to="/browse" className="clay-btn mt-4 inline-flex px-5 py-2.5 text-sm font-extrabold">
                Browse available food
              </Link>
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {[...list].reverse().map((r) => (
                <li key={r.ref} className="clay-inset flex flex-wrap items-center gap-3 px-4 py-3.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-card text-xl shadow-sm">
                    📦
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.donationTitle}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                      #{r.ref} · {r.quantity} servings · queued {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <ClayBadge className={statusClass(r.status)}>{r.status}</ClayBadge>
                  <Link to="/track" className="text-xs font-bold text-[#c07f1d]">
                    Track →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="clay p-6">
            <h3 className="font-extrabold">Quick actions</h3>
            <div className="mt-4 space-y-3">
              <QuickAction icon={Search} label="View available food" to="/browse" tone="clay-tile-amber text-[#5a3d0c]" />
              <QuickAction icon={Truck} label="Track deliveries" to="/track" tone="clay-tile-sky text-[#274066]" />
              <QuickAction icon={Users} label="Manage profile" to="/profile" tone="clay-tile-sage text-[#2f4a26]" />
            </div>
          </div>
          <ActivityStack />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Admin home                                                          */
/* ------------------------------------------------------------------ */
function AdminHome() {
  const stats = useQuery(api.donations.stats);
  const distribution = useQuery(api.donations.weeklyDistribution);
  const pendingQueue = useQuery(api.requests.pendingQueue);
  const approve = useMutation(api.requests.approve);

  const chart = distribution ?? [];
  const queue = pendingQueue ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Total donors" value={formatNumber(stats?.totalDonors ?? 0)} tone="amber" />
        <StatCard icon={HeartHandshake} label="Total NGOs" value={formatNumber(stats?.totalNgos ?? 0)} tone="sage" />
        <StatCard icon={Gift} label="Total donations" value={formatNumber(stats?.totalDonations ?? 0)} tone="sky" />
        <StatCard icon={Inbox} label="Total requests" value={formatNumber(stats?.totalRequests ?? 0)} tone="coral" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="clay p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold">Food distribution</h3>
              <p className="text-xs text-muted-foreground">Servings moved in the last 7 days</p>
            </div>
            <ClayBadge className="bg-[#fdecc8] text-[#7a5410]">
              <PieChart className="size-3" /> weekly
            </ClayBadge>
          </div>

          <div className="mt-5 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fontWeight: 700, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fontWeight: 700, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(233,162,59,0.12)", radius: 12 }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "none",
                    borderRadius: "1rem",
                    boxShadow: "8px 8px 18px rgba(75,62,44,0.15)",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />
                <Bar dataKey="meals" radius={[10, 10, 10, 10]}>
                  {chart.map((entry, i) => (
                    <Cell key={entry.day} fill={i === chart.length - 1 ? "var(--chart-2)" : "var(--chart-1)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <ActivityStack />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="clay p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold">Pending request queue</h3>
              <p className="text-xs text-muted-foreground">
                Next request served is always position 0.
              </p>
            </div>
            <ClayBadge className="bg-[#dbe7f7] text-[#2c4a77]">queue head → tail</ClayBadge>
          </div>

          {queue.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">The queue is empty — nice work.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {queue.map((r) => (
                <li key={r.ref} className="clay-inset flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="grid size-8 place-items-center rounded-xl bg-card text-xs font-extrabold shadow-sm tabular-nums">
                    {r.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.donationTitle}</p>
                    <p className="text-[11px] font-semibold text-muted-foreground">
                      {r.ngoName} · {r.quantity} servings · {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await approve({ ref: r.ref });
                        toast.success(`Request #${r.ref} approved`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not approve");
                      }
                    }}
                  >
                    Approve
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="clay p-6">
          <h3 className="font-extrabold">DS shortcuts</h3>
          <p className="text-xs text-muted-foreground">Jump into the C engine lab.</p>
          <div className="mt-4 space-y-3">
            <QuickAction icon={Layers} label="Stack — history" to="/ds?tab=stack" tone="clay-tile-sky text-[#274066]" />
            <QuickAction icon={ListOrdered} label="Queue — requests" to="/ds?tab=queue" tone="clay-tile-amber text-[#5a3d0c]" />
            <QuickAction icon={Timer} label="Heap — expiry" to="/ds?tab=pq" tone="clay-tile-coral text-[#6d2f24]" />
            <QuickAction icon={Search} label="BST — search ids" to="/ds?tab=bst" tone="clay-tile-sage text-[#2f4a26]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
function RoleSwitcher({ current, onChange }: { current: AccountType; onChange: (t: AccountType) => void }) {
  return (
    <div className="clay-soft flex gap-1 p-1.5">
      {ACCOUNT_TYPES.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-bold transition-all",
            current === t ? "clay-inset" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {roleLabel(t)}
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  useEnsureSeed();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const updateProfile = useMutation(api.profile.update);
  const appliedRole = useRef(false);

  const roleParam = params.get("role");
  const accountType: AccountType | null =
    user?.accountType === "donor" || user?.accountType === "ngo" || user?.accountType === "admin"
      ? user.accountType
      : null;

  // Landing CTAs carry ?role=donor|ngo|admin through returnTo — apply once.
  useEffect(() => {
    if (!roleParam || appliedRole.current) return;
    if (!ACCOUNT_TYPES.includes(roleParam as AccountType)) return;
    if (user?.accountType === roleParam) {
      appliedRole.current = true;
      return;
    }
    appliedRole.current = true;
    updateProfile({ accountType: roleParam as AccountType }).catch((err) => {
      console.warn("role apply failed", err);
      appliedRole.current = false;
    });
  }, [roleParam, user, updateProfile]);

  const switchRole = async (t: AccountType) => {
    try {
      await updateProfile({ accountType: t });
      toast.success(`Switched to the ${roleLabel(t)} experience`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch role");
    }
  };

  const name = user?.name || user?.email?.split("@")[0] || "friend";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {!accountType ? (
          <RolePicker busy={false} onPick={(t) => void switchRole(t)} />
        ) : (
          <div className="space-y-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <PageHeader
                title={`${greeting()}, ${name}`}
                subtitle={
                  accountType === "donor"
                    ? "Let's get your surplus food moving — every minute counts against the expiry clock."
                    : accountType === "ngo"
                      ? "Together we can feed more people. Requests are served oldest-first."
                      : "Admin overview: the network, the queue and the data structures."
                }
                action={
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="clay-soft hidden px-3.5 py-2 text-xs font-bold text-muted-foreground sm:inline-flex">
                      <LayoutDashboard className="mr-1.5 size-3.5" />
                      {roleLabel(accountType)} workspace
                    </span>
                    <RoleSwitcher current={accountType} onChange={(t) => void switchRole(t)} />
                  </div>
                }
              />
            </div>

            {accountType === "donor" && <DonorHome name={name} />}
            {accountType === "ngo" && <NgoHome name={name} />}
            {accountType === "admin" && <AdminHome />}

            <div className="grid gap-4 sm:grid-cols-3">
              <QuickAction icon={Boxes} label="Browse the board" to="/browse" tone="clay-tile-amber text-[#5a3d0c]" />
              <QuickAction icon={Send} label="Post a donation" to="/donate" tone="clay-tile-sage text-[#2f4a26]" />
              <QuickAction icon={Network} label="Inspect data structures" to="/ds" tone="clay-tile-sky text-[#274066]" />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
