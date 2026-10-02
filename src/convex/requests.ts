import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Queue } from "../lib/ds";
import { DELIVERY_STEPS } from "../lib/constants";
import { getStatsDoc, requireUser } from "./donations";
import { mutation, query } from "./_generated/server";

async function nextRef(ctx: Parameters<typeof requireUser>[0]) {
  const stats = await getStatsDoc(ctx);
  if (stats) {
    const ref = stats.nextRef;
    await ctx.db.patch(stats._id, { nextRef: ref + 1 });
    return ref;
  }
  return 5000 + Math.floor(Math.random() * 9000);
}

/**
 * All requests in strict FIFO order — the queue that the C backend keeps in
 * `queue_enqueue` order. Oldest request first, always.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const requests = await ctx.db.query("requests").collect();
    const queue = new Queue<(typeof requests)[number]>();
    for (const r of [...requests].sort((a, b) => a.createdAt - b.createdAt)) queue.enqueue(r);
    return queue.toArray();
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const requests = await ctx.db
      .query("requests")
      .withIndex("by_ngo", (q) => q.eq("ngoId", userId))
      .collect();
    return [...requests].sort((a, b) => a.createdAt - b.createdAt);
  },
});

/** Pending queue with each request's 0-based position (FIFO index). */
export const pendingQueue = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("requests")
      .withIndex("by_status", (q) => q.eq("status", "PENDING"))
      .collect();
    const queue = new Queue<(typeof pending)[number]>();
    for (const r of [...pending].sort((a, b) => a.createdAt - b.createdAt)) queue.enqueue(r);
    return queue.toArray().map((r, position) => ({ ...r, position }));
  },
});

/**
 * Enqueue a request for an available donation: validates ownership/roles
 * (only NGO accounts may request), flips the donation to CLAIMED and pushes
 * the action onto the activity stack (via the activity table).
 */
export const create = mutation({
  args: { donationRef: v.number(), quantity: v.number() },
  handler: async (ctx, { donationRef, quantity }) => {
    const { userId, user } = await requireUser(ctx);
    if (user.accountType !== "ngo" && user.accountType !== "admin") {
      throw new Error("Switch your profile to an NGO account to request food.");
    }
    if (quantity <= 0) throw new Error("Quantity must be positive.");

    const donations = await ctx.db.query("donations").collect();
    const donation = donations.find((d) => d.ref === donationRef);
    if (!donation) throw new Error("Donation not found.");
    if (donation.status !== "AVAILABLE") throw new Error("This food was already claimed.");
    if (donation.expiresAt <= Date.now())
      throw new Error("This donation has expired and can no longer be claimed.");

    const ngoName = user.organization || user.name || user.email || "NGO";
    const now = Date.now();
    const ref = await nextRef(ctx);

    await ctx.db.patch(donation._id, {
      status: "CLAIMED",
      ngoId: userId,
      ngoName,
    });

    await ctx.db.insert("requests", {
      ref,
      donationRef,
      donationTitle: donation.title,
      ngoId: userId,
      ngoName,
      quantity: Math.min(Math.round(quantity), donation.quantity),
      status: "PENDING",
      step: 0,
      createdAt: now,
    });

    await ctx.db.insert("activity", {
      actor: ngoName,
      kind: "request",
      text: `Requested “${donation.title}” — enqueued (FIFO)`,
      ts: now,
    });

    return { ref };
  },
});

/** Admin approves a pending request. */
export const approve = mutation({
  args: { ref: v.number() },
  handler: async (ctx, { ref }) => {
    const { user } = await requireUser(ctx);
    if (user.accountType !== "admin") throw new Error("Only admins can approve requests.");
    const requests = await ctx.db.query("requests").collect();
    const target = requests.find((r) => r.ref === ref);
    if (!target) throw new Error("Request not found.");
    if (target.status !== "PENDING") throw new Error("Request is not pending.");
    await ctx.db.patch(target._id, { status: "APPROVED" });
    await ctx.db.insert("activity", {
      actor: user.name || user.email || "Admin",
      kind: "approval",
      text: `Request #${ref} approved`,
      ts: Date.now(),
    });
    return { ref };
  },
});

/**
 * Advance the delivery timeline one node forward along the linked list of
 * steps. The last step marks the request DELIVERED and the food DISTRIBUTED.
 */
export const advanceStep = mutation({
  args: { ref: v.number() },
  handler: async (ctx, { ref }) => {
    const { user } = await requireUser(ctx);
    const requests = await ctx.db.query("requests").collect();
    const target = requests.find((r) => r.ref === ref);
    if (!target) throw new Error("Request not found.");

    // Role rule: donors can never move a delivery — only NGO or admin accounts.
    // (Seeded partner NGOs have no signed-in account, so any NGO may co-ordinate
    // their hand-over in this demo.)
    if (user.accountType !== "ngo" && user.accountType !== "admin") {
      throw new Error("Only an NGO or admin can update this delivery.");
    }
    if (target.status === "DELIVERED") throw new Error("Already delivered.");
    if (target.step >= DELIVERY_STEPS.length - 1) throw new Error("Route already complete.");

    const step = target.step + 1;
    const last = step === DELIVERY_STEPS.length - 1;
    await ctx.db.patch(target._id, {
      step,
      status: last ? "DELIVERED" : target.status === "PENDING" ? "APPROVED" : target.status,
    });

    // Keep the donation in lock-step with the route.
    const donations = await ctx.db.query("donations").collect();
    const donation = donations.find((d) => d.ref === target.donationRef);
    if (donation) {
      if (step >= 2 && donation.status === "CLAIMED") {
        await ctx.db.patch(donation._id, { status: "COLLECTED", collectedAt: Date.now() });
      }
      if (last && donation.status !== "DISTRIBUTED") {
        await ctx.db.patch(donation._id, { status: "DISTRIBUTED" });
      }
    }

    await ctx.db.insert("activity", {
      actor: user.name || user.email || "Volunteer",
      kind: "delivery",
      text: `#${target.ref} reached “${DELIVERY_STEPS[step]}”`,
      ts: Date.now(),
    });

    return { ref, step, label: DELIVERY_STEPS[step], done: last };
  },
});
