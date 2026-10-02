import { api } from "@/convex/_generated/api";
import { AppShell } from "@/components/AppShell";
import { ClayBadge, PageHeader } from "@/components/ui-clay";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useCEngine } from "@/hooks/use-c-engine";
import { useEnsureSeed } from "@/hooks/use-seed";
import { cn } from "@/lib/utils";
import { expiryInfo, foodEmoji, statusClass } from "@/lib/format";
import { minutesUntil } from "@/lib/ds";
import { Clock, MapPin, Search, Sparkles, Timer, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const FILTERS = ["All", "Cooked Food", "Fresh Produce", "Bakery", "Packaged"] as const;

type Donation = {
  ref: number;
  title: string;
  foodType: string;
  quantity: number;
  location: string;
  expiresAt: number;
  status: string;
  donorName: string;
  notes?: string;
};

export default function Browse() {
  useEnsureSeed();
  const donations = useQuery(api.donations.list);
  const { user } = useAuth();
  const { engine, status: engineStatus } = useCEngine();
  const createRequest = useMutation(api.requests.create);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");
  const [searchInfo, setSearchInfo] = useState<string | null>(null);
  const [selected, setSelected] = useState<Donation | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  const all: Donation[] = useMemo(() => donations ?? [], [donations]);

  /* ---- Order the board through the C binary min-heap (fallback: server order) ---- */
  const [heapOrder, setHeapOrder] = useState<number[] | null>(null);
  useEffect(() => {
    if (!engine || all.length === 0) return;
    const order = engine.pqOrder(
      all.map((d) => ({ id: d.ref, priority: minutesUntil(d.expiresAt) })),
    );
    setHeapOrder(order);
  }, [engine, all]);

  const ordered = useMemo(() => {
    if (!heapOrder) return all;
    const byRef = new Map(all.map((d) => [d.ref, d]));
    return heapOrder.map((ref) => byRef.get(ref)).filter((d): d is Donation => !!d);
  }, [all, heapOrder]);

  /* ---- Search: text filter + C BST id lookup ---- */
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    if (/^\d+$/.test(q)) {
      const ref = Number(q);
      return ordered.filter((d) => d.ref === ref || String(d.ref).includes(q));
    }
    return ordered.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.donorName.toLowerCase().includes(q) ||
        d.foodType.toLowerCase().includes(q),
    );
  }, [ordered, query]);

  const grouped = filter === "All" ? visible : visible.filter((d) => d.foodType === filter);

  // BST lookup runs in C whenever the query looks like a donation id.
  useEffect(() => {
    if (!engine) return;
    const q = query.trim();
    if (!/^\d+$/.test(q)) {
      setSearchInfo(null);
      return;
    }
    engine.bstClear();
    for (const d of all) engine.bstInsert(d.ref);
    const ref = Number(q);
    const depth = engine.bstSearch(ref);
    const lines = engine.trace();
    const line = lines[lines.length - 1] ?? "bst_search()";
    setSearchInfo(depth >= 0 ? line : `${line} · not in tree`);
  }, [query, engine, all]);

  const openRequest = (d: Donation) => {
    setSelected(d);
    setQuantity(String(Math.min(10, d.quantity)));
  };

  const submitRequest = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await createRequest({
        donationRef: selected.ref,
        quantity: Number(quantity),
      });
      toast.success(`Request #${res.ref} enqueued — FIFO position served oldest-first.`);
      setSelected(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send the request.";
      toast.error(msg);
      if (msg.includes("NGO")) toast.info("Switch your profile to an NGO account first.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <PageHeader
          title="Available food donations"
          subtitle="Everything below is ordered by the C priority queue — soonest expiry first — and searchable by id through the C binary search tree."
          action={
            <ClayBadge className={cn("px-3 py-1.5", engineStatus === "ready" ? "bg-[#fdecc8] text-[#7a5410]" : "bg-muted text-muted-foreground")}>
              <Sparkles className="size-3" />
              {engineStatus === "ready" ? "C heap active" : "loading C engine…"}
            </ClayBadge>
          }
        />

        {/* ---------------------------- search bar ---------------------------- */}
        <div className="clay mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="clay-inset flex flex-1 items-center gap-2 px-4 py-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by food, place or donation id (#1005)…"
              className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground/80"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search">
                <X className="size-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all",
                  filter === f
                    ? "clay-inset"
                    : "bg-card text-muted-foreground shadow-sm hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {searchInfo && (
          <div className="clay-inset mt-3 flex items-center gap-2 px-4 py-2.5 text-xs font-bold">
            <span className="text-[#4a7a38]">$</span>
            <code className="truncate font-mono">{searchInfo}</code>
          </div>
        )}

        {/* ------------------------------- board ------------------------------ */}
        {grouped.length === 0 ? (
          <div className="clay mt-6 px-6 py-16 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-card text-3xl shadow-md">
              🍽️
            </div>
            <p className="mt-4 text-lg font-extrabold">Nothing matches that search</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Try a different filter, or check back soon — donors post fresh surplus
              throughout the day.
            </p>
            <button className="clay-btn mt-5 px-5 py-2.5 text-sm font-extrabold" onClick={() => { setQuery(""); setFilter("All"); }}>
              Reset the board
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {grouped.map((d) => {
              const info = expiryInfo(d.expiresAt);
              const claimable = d.status === "AVAILABLE" && !info.expired;
              return (
                <article key={d.ref} className="clay flex flex-col p-5 transition-transform duration-200 hover:-translate-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-14 place-items-center rounded-2xl bg-[#f4ede2] text-2xl shadow-inner">
                      {foodEmoji(d.foodType)}
                    </span>
                    <ClayBadge className={statusClass(d.status)}>{d.status}</ClayBadge>
                  </div>

                  <h3 className="mt-4 text-lg leading-tight font-extrabold">{d.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">
                    {d.quantity} servings · {d.foodType}
                  </p>

                  <div className="mt-3 space-y-1.5 text-xs font-semibold text-muted-foreground">
                    <p className={cn("flex items-center gap-1.5", info.urgent && "text-[#b4553f]")}>
                      <Timer className="size-3.5" /> {info.label}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {d.location}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Clock className="size-3.5" /> from {d.donorName}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/70 pt-4">
                    <code className="text-[11px] font-bold text-muted-foreground">#{d.ref}</code>
                    {claimable ? (
                      <Button size="sm" onClick={() => openRequest(d)}>
                        Request
                      </Button>
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">
                        {info.expired ? "Expired" : "Claimed already"}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-center text-xs font-semibold text-muted-foreground">
          Serving as{" "}
          <span className="font-bold text-foreground">
            {user?.organization || user?.name || "guest"}
          </span>{" "}
          · only NGO accounts can claim food ·{" "}
          <Link to="/profile" className="font-bold underline underline-offset-4">
            switch role
          </Link>
        </p>
      </div>

      {/* ----------------------------- request dialog ---------------------------- */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-[#f4ede2] text-2xl shadow-inner">
                    {foodEmoji(selected.foodType)}
                  </span>
                  <div>
                    <DialogTitle className="text-xl font-extrabold">{selected.title}</DialogTitle>
                    <DialogDescription>
                      {selected.quantity} servings · {selected.location} · from {selected.donorName}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="clay-inset grid grid-cols-3 gap-3 p-4 text-center">
                <div>
                  <p className="text-lg font-extrabold tabular-nums">{selected.quantity}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">servings</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold tabular-nums">
                    {Math.max(1, Math.round((selected.expiresAt - Date.now()) / 3600000))}h
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">left</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold">#{selected.ref}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">bst id</p>
                </div>
              </div>

              {selected.notes && (
                <p className="text-sm leading-6 text-muted-foreground">{selected.notes}</p>
              )}

              <div className="space-y-2">
                <Label htmlFor="req-qty">Request quantity (servings)</Label>
                <Select value={quantity} onValueChange={setQuantity}>
                  <SelectTrigger id="req-qty" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Math.min(selected.quantity, 12) }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} serving{n > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button onClick={() => void submitRequest()} disabled={submitting}>
                  {submitting ? "Enqueuing…" : "Submit request"}
                </Button>
              </DialogFooter>

              <p className="text-[11px] font-semibold text-muted-foreground">
                The request enters the FIFO queue; the donation flips to CLAIMED the moment
                the backend accepts it.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
