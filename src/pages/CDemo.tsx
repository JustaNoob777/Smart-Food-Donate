import { useCallback, useEffect, useState } from "react";
import { Activity, Clock3, Network, PackagePlus, RefreshCw, Truck } from "lucide-react";

const API = (import.meta.env.VITE_C_API_URL || "http://localhost:8080").replace(/\/$/, "");

type Donation = {
  id: number;
  title: string;
  quantity: number;
  location: string;
  expires_in_minutes: number;
  status: string;
  ngo_id: number;
};

type RequestRow = {
  id: number;
  donation_id: number;
  ngo_id: number;
  quantity: number;
  status: string;
  queue_position: number;
};

type Health = {
  engine: string;
  donations: number;
  requests: number;
  structures: Record<string, number>;
};

type Snapshot = {
  health: Health;
  donations: Donation[];
  requests: RequestRow[];
  dispatch: Array<{ id: number; donation_id: number; status: string; dispatch_position: number }>;
  history: Array<{ code: number; action: string; stack_depth: number }>;
  bst: { size: number; height: number; inorder: number[] };
  route: Array<{ step: number; name: string }>;
  graph: { mode: string; start: number; order: number[]; names: string[] };
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) throw new Error(`C server returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function postJson<T>(path: string, data: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `C server returned ${response.status}`);
  return result as T;
}

const emptySnapshot: Snapshot = {
  health: { engine: "C", donations: 0, requests: 0, structures: {} },
  donations: [], requests: [], dispatch: [], history: [],
  bst: { size: 0, height: -1, inorder: [] }, route: [],
  graph: { mode: "bfs", start: 0, order: [], names: [] },
};

export default function CDemo() {
  const [data, setData] = useState<Snapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [health, donations, requests, dispatch, history, bst, route, graph] = await Promise.all([
        getJson<Health>("/api/health"),
        getJson<Donation[]>("/api/donations"),
        getJson<RequestRow[]>("/api/requests"),
        getJson<Snapshot["dispatch"]>("/api/dispatch"),
        getJson<Snapshot["history"]>("/api/history"),
        getJson<Snapshot["bst"]>("/api/bst"),
        getJson<Snapshot["route"]>("/api/route"),
        getJson<Snapshot["graph"]>("/api/graph/bfs?from=0"),
      ]);
      setData({ health, donations, requests, dispatch, history, bst, route, graph });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the C server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const runAction = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      await action();
      setNotice(message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The C operation failed.");
    } finally {
      setBusy(false);
    }
  };

  const addDonation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void runAction(() => postJson("/api/donations", {
      title: String(form.get("title")),
      location: String(form.get("location")),
      quantity: Number(form.get("quantity")),
      expires_in: Number(form.get("expires_in")),
    }), "Donation stored by the C backend and indexed in its BST and min-heap.");
    event.currentTarget.reset();
  };

  return (
    <main className="min-h-screen bg-[#f5f0e6] px-4 py-8 text-[#26352a] sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#65805b]">FoodShare · C backend</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Smart food donation operations</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#647064]">This screen sends each action to the native C program. Its queues, heap, BST, linked list, stack, deque, and graph manage the demo workflow.</p>
          </div>
          <button onClick={() => void refresh()} disabled={loading || busy} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold shadow-sm disabled:opacity-50">
            <RefreshCw className="size-4" /> Refresh C data
          </button>
        </header>

        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>C backend unavailable.</strong> {error} Start it from the project folder with <code className="font-bold">make api</code>, then reload this page.
        </div>}
        {notice && <div role="status" className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">{notice}</div>}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Donations", data.health.donations], ["Pending requests", data.health.structures.queue ?? 0],
            ["Urgent dispatch", data.health.structures.deque ?? 0], ["BST height", data.bst.height],
          ].map(([label, value]) => <div key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-[#758174]">{label}</p>
            <p className="mt-1 text-2xl font-black">{loading ? "…" : value}</p>
          </div>)}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2"><Clock3 className="size-5 text-[#65805b]" /><h2 className="text-xl font-extrabold">Food board · earliest expiry first</h2></div>
            <div className="space-y-3">
              {data.donations.map((donation) => <article key={donation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f7f5ef] p-4">
                <div><p className="font-extrabold">{donation.title} <span className="text-xs font-semibold text-[#758174]">#{donation.id}</span></p>
                  <p className="mt-1 text-sm text-[#647064]">{donation.quantity} servings · {donation.location} · expires in {donation.expires_in_minutes} min</p></div>
                <div className="flex items-center gap-2"><span className="rounded-full bg-white px-3 py-1 text-xs font-bold">{donation.status}</span>
                  {donation.status === "AVAILABLE" && <button disabled={busy} onClick={() => void runAction(() => postJson("/api/requests", { donation_id: donation.id, ngo_id: 1, quantity: 1, account_type: "ngo" }), "Request added to the FIFO queue and urgent-first deque.")} className="rounded-xl bg-[#527247] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Request 1 serving</button>}</div>
              </article>)}
              {!loading && data.donations.length === 0 && <p className="py-8 text-center text-sm text-[#758174]">No donations yet.</p>}
            </div>
          </section>

          <section className="space-y-6">
            <form onSubmit={addDonation} className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-2"><PackagePlus className="size-5 text-[#65805b]" /><h2 className="text-xl font-extrabold">Add surplus food</h2></div>
              <div className="space-y-3">
                <input name="title" required maxLength={63} placeholder="Food name" className="w-full rounded-xl border border-[#e4e4da] px-3 py-2.5 text-sm" />
                <input name="location" required maxLength={47} placeholder="Pickup location" className="w-full rounded-xl border border-[#e4e4da] px-3 py-2.5 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-bold text-[#647064]">Servings<input name="quantity" type="number" min="1" defaultValue="20" required className="mt-1 w-full rounded-xl border border-[#e4e4da] px-3 py-2.5 text-sm text-[#26352a]" /></label>
                  <label className="text-xs font-bold text-[#647064]">Expiry (minutes)<input name="expires_in" type="number" min="1" defaultValue="90" required className="mt-1 w-full rounded-xl border border-[#e4e4da] px-3 py-2.5 text-sm text-[#26352a]" /></label>
                </div>
                <button disabled={busy} className="w-full rounded-xl bg-[#527247] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">Save donation in C</button>
              </div>
            </form>

            <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-lg font-extrabold">Request queue · FIFO</h2>
                <button disabled={busy || data.requests.length === 0} onClick={() => void runAction(() => postJson("/api/requests/claim", {}), "Oldest request removed from the FIFO queue.")} className="rounded-xl bg-[#e9a23b] px-3 py-2 text-xs font-extrabold text-[#49320e] disabled:opacity-50">Serve oldest</button></div>
              {data.requests.length === 0 ? <p className="text-sm text-[#758174]">No pending requests.</p> : data.requests.map((request) => <p key={request.id} className="border-t border-[#eeeeea] py-2 text-sm">#{request.id} → donation #{request.donation_id} <span className="text-[#758174]">(position {request.queue_position + 1})</span></p>)}
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#758174]">Deque dispatch order</p>
              <p className="mt-1 text-sm">{data.dispatch.map((r) => `#${r.id}`).join("  →  ") || "Empty"}</p>
            </section>
          </section>
        </div>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-extrabold"><Activity className="size-4" /> Recent actions · stack</h2>
            {data.history.slice(0, 5).map((item, i) => <p key={`${item.code}-${i}`} className="mt-2 text-sm text-[#647064]">{item.action}</p>)}
          </article>
          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="font-extrabold">Donation ID index · BST</h2>
            <p className="mt-2 text-sm text-[#647064]">In order: {data.bst.inorder.join(", ") || "Empty"}</p>
            <p className="mt-1 text-xs text-[#758174]">Height {data.bst.height} · {data.bst.size} indexed donations</p>
          </article>
          <article className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-extrabold"><Truck className="size-4" /> Delivery route · linked list</h2>
            <p className="mt-2 text-sm text-[#647064]">{data.route.map((step) => step.name).join(" → ")}</p>
          </article>
        </section>

        <section className="rounded-3xl bg-[#26352a] p-5 text-white shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><Network className="size-5" /> Donor network · graph BFS</h2>
          <p className="mt-2 text-sm text-white/75">{data.graph.order.map((node) => data.graph.names[node]).filter(Boolean).join(" → ") || "Start the C backend to explore the network."}</p>
          <p className="mt-3 text-xs text-white/60">C engine status: {data.health.engine} · structures ready: {Object.keys(data.health.structures).join(", ")}</p>
        </section>

        <footer className="text-center text-xs text-[#758174]">C server: {API} · Memory-only demo data resets when the server restarts.</footer>
      </div>
    </main>
  );
}
