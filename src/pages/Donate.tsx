import { api } from "@/lib/api";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/ui-clay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCEngine } from "@/hooks/use-c-engine";
import { minutesUntil } from "@/lib/ds";
import { cn } from "@/lib/utils";
import {
  Clock,
  Gift,
  HeartHandshake,
  MapPin,
  PackageCheck,
  Sprout,
  Timer,
} from "lucide-react";
import { useMutation } from "@/lib/c-api";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const FOOD_TYPES = [
  "Cooked Food",
  "Fresh Produce",
  "Bakery",
  "Packaged",
  "Beverages",
  "Other",
];

function defaultExpiry() {
  const d = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Donate() {
  const navigate = useNavigate();
  const create = useMutation(api.donations.create);
  const { engine } = useCEngine();
  const [foodType, setFoodType] = useState<string>("Cooked Food");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const quantity = Number(form.get("quantity"));
    const location = String(form.get("location") ?? "").trim();
    const expiry = String(form.get("expiry") ?? "");
    const notes = String(form.get("notes") ?? "").trim();
    const expiresAt = expiry ? new Date(expiry).getTime() : Number.NaN;

    if (!title) return toast.error("Give the donation a name.");
    if (!quantity || quantity <= 0)
      return toast.error("Quantity must be a positive number.");
    if (!location) return toast.error("Add a pickup location.");
    if (!expiresAt || Number.isNaN(expiresAt))
      return toast.error("Pick an expiry date & time.");
    if (expiresAt <= Date.now())
      return toast.error("Expiry must be later than the current time.");

    setBusy(true);
    try {
      const res = await create({
        title,
        foodType,
        quantity,
        location,
        expiresAt,
        notes,
      });
      if (engine) {
        engine.bstInsert(res.ref);
        engine.pqInsert(res.ref, minutesUntil(expiresAt));
        engine.stackPush(res.ref);
      }
      toast.success(
        `Donation #${res.ref} created — bst_insert(${res.ref}) ok, pushed to the expiry heap.`,
      );
      navigate("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create the donation.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <PageHeader
          title="Add food donation"
          subtitle="Tell us what's surplus today. The backend validates the rules, indexes the id in a BST and drops it into the expiry priority queue."
        />

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* ------------------------------ form ------------------------------ */}
          <form onSubmit={onSubmit} className="clay p-6 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="title">Donation name</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="e.g. Cooked Rice + Curry"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Food type</Label>
                <Select value={foodType} onValueChange={setFoodType}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select food type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FOOD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="foodType" value={foodType} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity (servings)</Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  placeholder="e.g. 10 meals / 5 kg"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Pickup location</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="e.g. Kozhikode"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry date &amp; time</Label>
                <Input
                  id="expiry"
                  name="expiry"
                  type="datetime-local"
                  defaultValue={defaultExpiry()}
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Additional notes (optional)</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="e.g. Freshly cooked, vegetarian, pack in own containers…"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="submit" disabled={busy} className="px-7">
                {busy ? "Submitting…" : "Submit donation"}
              </Button>
              <p className="text-xs font-semibold text-muted-foreground">
                Rules enforced server-side: quantity &gt; 0 and expiry in the
                future.
              </p>
            </div>
          </form>

          {/* ---------------------------- side panel --------------------------- */}
          <aside className="space-y-6">
            <div className="clay-tile-amber relative overflow-hidden rounded-[1.75rem] p-6">
              <span className="absolute -top-5 -right-4 text-5xl">🥡</span>
              <span className="absolute right-10 bottom-4 text-3xl">🌾</span>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1 text-[11px] font-extrabold text-[#5a3d0c]">
                <Sprout className="size-3.5" /> Your donation makes a difference
              </p>
              <h3 className="mt-4 text-2xl leading-tight font-extrabold text-[#4a3210]">
                Help reduce food waste and fight hunger in your community.
              </h3>
              <p className="mt-2 text-sm leading-6 font-semibold text-[#6b4d1d]">
                Food that would have been thrown away becomes a meal for a
                family — usually within hours.
              </p>
            </div>

            <div className="clay p-6">
              <h3 className="font-extrabold">What happens next</h3>
              <ol className="mt-4 space-y-3.5">
                {[
                  {
                    icon: PackageCheck,
                    text: "Your donation is validated and indexed by id (BST).",
                  },
                  {
                    icon: Timer,
                    text: "Expiry time becomes its priority in the min-heap.",
                  },
                  {
                    icon: Clock,
                    text: "NGOs see it at the top of the board if it's urgent.",
                  },
                  {
                    icon: HeartHandshake,
                    text: "A request arrives through the FIFO queue.",
                  },
                  {
                    icon: MapPin,
                    text: "A volunteer picks it up and the route advances.",
                  },
                ].map((s, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-xl",
                        i % 2 === 0
                          ? "clay-tile-sage text-[#2f4a26]"
                          : "clay-tile-sky text-[#274066]",
                      )}
                    >
                      <s.icon className="size-4" />
                    </span>
                    <p className="pt-1 text-sm leading-5 text-muted-foreground">
                      {s.text}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="clay-inset mt-5 flex items-center gap-3 px-4 py-3">
                <Gift className="size-5 shrink-0 text-[#c07f1d]" />
                <p className="text-xs font-semibold">
                  Demo tip: short expiries jump straight to the front of the
                  queue.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
