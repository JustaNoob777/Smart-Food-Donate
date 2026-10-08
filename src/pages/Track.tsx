import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { ClayBadge, PageHeader } from "@/components/ui-clay";
import { Button } from "@/components/ui/button";
import { useCEngine } from "@/hooks/use-c-engine";
import { cn } from "@/lib/utils";
import { expiryInfo, foodEmoji, statusClass, timeAgo } from "@/lib/format";
import { DELIVERY_STEPS } from "@/lib/constants";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Navigation,
  PackageCheck,
  Truck,
} from "lucide-react";
import { useMutation, useQuery } from "@/lib/c-api";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/* A soft, hand-drawn feeling map — no external tiles needed. */
function RouteMap({ step }: { step: number }) {
  const progress = Math.min(1, step / (DELIVERY_STEPS.length - 1));
  return (
    <div className="clay-inset relative overflow-hidden p-4">
      <svg
        viewBox="0 0 400 230"
        className="h-auto w-full"
        role="img"
        aria-label="Delivery route map"
      >
        {/* blocks */}
        <rect x="14" y="16" width="96" height="64" rx="16" fill="#e7dcc9" />
        <rect x="132" y="16" width="120" height="44" rx="16" fill="#dce9d4" />
        <rect x="274" y="16" width="112" height="76" rx="16" fill="#e7dcc9" />
        <rect x="14" y="104" width="72" height="110" rx="16" fill="#dbe7f7" />
        <rect x="106" y="92" width="140" height="60" rx="16" fill="#fdecc8" />
        <rect x="266" y="118" width="120" height="96" rx="16" fill="#dce9d4" />
        <rect x="106" y="170" width="140" height="44" rx="16" fill="#e7dcc9" />

        {/* river */}
        <path
          d="M0 92 C 80 76, 150 120, 230 104 S 360 76, 400 96"
          stroke="#b9d3ef"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
        />

        {/* route */}
        <path
          d="M46 48 C 120 48, 150 120, 200 122 S 320 150, 352 178"
          stroke="#e9a23b"
          strokeWidth="5"
          fill="none"
          strokeDasharray="10 10"
          strokeLinecap="round"
        />
        <path
          d="M46 48 C 120 48, 150 120, 200 122 S 320 150, 352 178"
          stroke="#e08a7b"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - progress}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />

        {/* markers */}
        <circle cx="46" cy="48" r="13" fill="#7fb069" />
        <text x="46" y="53" textAnchor="middle" fontSize="13">
          🍴
        </text>

        <circle cx="200" cy="122" r="13" fill="#6f9bd8" />
        <text x="200" y="127" textAnchor="middle" fontSize="13">
          📦
        </text>

        <circle cx="352" cy="178" r="13" fill="#e9a23b" />
        <text x="352" y="183" textAnchor="middle" fontSize="13">
          🏠
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ClayBadge className="bg-card text-foreground shadow-sm">
          <Navigation className="size-3 text-[#c07f1d]" /> current step:{" "}
          {DELIVERY_STEPS[Math.min(step, DELIVERY_STEPS.length - 1)]}
        </ClayBadge>
        <span className="text-[11px] font-bold text-muted-foreground">
          donor → hub → volunteer → recipient
        </span>
      </div>
    </div>
  );
}

function isUrgent(expiresAt: number) {
  return expiresAt - Date.now() <= 2 * 60 * 60 * 1000;
}

export default function Track() {
  const requests = useQuery(api.requests.list);
  const donations = useQuery(api.donations.list);
  const advance = useMutation(api.requests.advanceStep);
  const { engine } = useCEngine();

  const dispatchOrder = useMemo(() => {
    if (!engine || !requests || !donations) return [];
    engine.dequeClear();
    const pending = requests.filter((request) => request.status === "PENDING");
    const urgency = (ref: number) => {
      const donation = donations.find((item) => item.ref === ref);
      return donation ? donation.expiresAt : Number.MAX_SAFE_INTEGER;
    };
    const urgent = pending
      .filter(
        (request) =>
          isUrgent(urgency(request.donationRef)),
      )
      .sort((a, b) => urgency(b.donationRef) - urgency(a.donationRef));
    const routine = pending
      .filter(
        (request) =>
          !isUrgent(urgency(request.donationRef)),
      )
      .sort((a, b) => a.createdAt - b.createdAt);
    urgent.forEach((request) => engine.dequePushFront(request.ref));
    routine.forEach((request) => engine.dequePushBack(request.ref));
    return engine.dequeAll();
  }, [engine, requests, donations]);
  const list = useMemo(() => {
    const rows = requests ?? [];
    const byRef = new Map(rows.map((request) => [request.ref, request]));
    const dispatched = dispatchOrder
      .map((ref) => byRef.get(ref))
      .filter((row): row is (typeof rows)[number] => !!row);
    const already = new Set(dispatched.map((row) => row.ref));
    return [
      ...dispatched,
      ...[...rows].reverse().filter((row) => !already.has(row.ref)),
    ];
  }, [requests, dispatchOrder]);
  const [selectedRef, setSelectedRef] = useState<number | null>(null);

  const selected = list.find((r) => r.ref === selectedRef) ?? list[0] ?? null;
  const donation =
    donations?.find((d) => d.ref === selected?.donationRef) ?? null;

  const advanceStep = async () => {
    if (!selected) return;
    try {
      if (engine) {
        engine.llClear();
        for (let i = 0; i <= selected.step; i++) engine.llPushBack(i);
      }
      const res = await advance({ ref: selected.ref });
      if (engine) {
        engine.llPushBack(res.step);
        engine.stackPush(selected.ref);
      }
      toast.success(
        res.done
          ? "Delivered — food reached the plate 🎉"
          : `Now at “${res.label}”`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not advance the route",
      );
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <PageHeader
          title="Delivery tracking"
          subtitle="Each delivery is a linked list: every step points to the next until the food is distributed."
          action={
            <ClayBadge className="bg-[#dbe7f7] px-3 py-1.5 text-[#2c4a77]">
              linked list · {DELIVERY_STEPS.length} nodes
            </ClayBadge>
          }
        />

        {list.length === 0 ? (
          <div className="clay mt-7 px-6 py-16 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-card text-3xl shadow-md">
              🚚
            </div>
            <p className="mt-4 text-lg font-extrabold">
              No deliveries in motion
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Request food from the board and its route will appear here, step
              by step.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid gap-6 lg:grid-cols-[22rem_1fr]">
            {/* --------------------------- request list --------------------------- */}
            <div className="clay h-fit p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold">Requests</h3>
                <ClayBadge className="bg-[#dbe7f7] text-[#2c4a77]">
                  C deque · urgent first
                </ClayBadge>
              </div>
              <ul className="mt-4 space-y-2.5">
                {list.map((r) => (
                  <li key={r.ref}>
                    <button
                      onClick={() => setSelectedRef(r.ref)}
                      className={cn(
                        "w-full rounded-2xl px-4 py-3 text-left transition-all",
                        selected?.ref === r.ref
                          ? "clay-inset"
                          : "bg-[#f4ede2] hover:bg-[#efe8db]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold">
                          {r.donationTitle}
                        </p>
                        <ClayBadge className={statusClass(r.status)}>
                          {r.status}
                        </ClayBadge>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                        #{r.ref} · {r.ngoName} · {timeAgo(r.createdAt)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* ------------------------------ details ------------------------------ */}
            {selected && (
              <div className="space-y-6">
                <div className="clay p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-14 place-items-center rounded-2xl bg-[#f4ede2] text-2xl shadow-inner">
                        {donation ? foodEmoji(donation.foodType) : "📦"}
                      </span>
                      <div>
                        <h3 className="text-xl font-extrabold">
                          {selected.donationTitle}
                        </h3>
                        <p className="text-sm font-semibold text-muted-foreground">
                          {selected.quantity} servings · requested by{" "}
                          {selected.ngoName}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <ClayBadge className={statusClass(selected.status)}>
                        {selected.status}
                      </ClayBadge>
                      <span className="text-xs font-bold text-muted-foreground">
                        #{selected.ref}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <RouteMap step={selected.step} />

                    {/* linked-list timeline */}
                    <ol className="relative space-y-0">
                      {DELIVERY_STEPS.map((label, i) => {
                        const done = i <= selected.step;
                        const current = i === selected.step;
                        return (
                          <li
                            key={label}
                            className="relative flex gap-3 pb-5 last:pb-0"
                          >
                            {i < DELIVERY_STEPS.length - 1 && (
                              <span
                                className={cn(
                                  "absolute top-7 left-[13px] h-full w-0.5",
                                  i < selected.step
                                    ? "bg-[#7fb069]"
                                    : "bg-border",
                                )}
                              />
                            )}
                            <span
                              className={cn(
                                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full shadow-sm",
                                done
                                  ? "clay-tile-sage text-[#2f4a26]"
                                  : "bg-[#efe8db] text-muted-foreground",
                                current && "ring-4 ring-[#e9a23b]/40",
                              )}
                            >
                              {done ? (
                                <CheckCircle2 className="size-4" />
                              ) : (
                                <Circle className="size-3.5" />
                              )}
                            </span>
                            <div className="pt-0.5">
                              <p
                                className={cn(
                                  "text-sm font-bold",
                                  !done && "text-muted-foreground",
                                )}
                              >
                                {label}
                              </p>
                              <p className="text-[11px] font-semibold text-muted-foreground">
                                {i === 0
                                  ? `queued ${timeAgo(selected.createdAt)}`
                                  : done
                                    ? "completed"
                                    : "waiting for the previous node"}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="clay-soft p-5">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
                      <MapPin className="size-3.5" /> Pickup
                    </p>
                    <p className="mt-1.5 font-extrabold">
                      {donation?.location ?? "—"}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {donation?.donorName ?? "Donor"}
                    </p>
                  </div>
                  <div className="clay-soft p-5">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
                      <Clock className="size-3.5" /> Expiry
                    </p>
                    <p className="mt-1.5 font-extrabold">
                      {donation ? expiryInfo(donation.expiresAt).label : "—"}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      food type: {donation?.foodType ?? "—"}
                    </p>
                  </div>
                  <div className="clay-soft p-5">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
                      <PackageCheck className="size-3.5" /> Quantity
                    </p>
                    <p className="mt-1.5 font-extrabold">
                      {selected.quantity} servings
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      donation #{selected.donationRef}
                    </p>
                  </div>
                </div>

                {selected.step < DELIVERY_STEPS.length - 1 && (
                  <div className="clay flex flex-wrap items-center justify-between gap-3 p-5">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Advancing moves the pointer to the next node and updates
                      the donation status server-side.
                    </p>
                    <Button
                      onClick={() => void advanceStep()}
                      className="gap-1.5"
                    >
                      <Truck className="size-4" />
                      Advance to “{DELIVERY_STEPS[selected.step + 1]}”
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
