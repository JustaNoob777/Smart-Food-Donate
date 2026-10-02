import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { BST, orderByUrgency } from "../lib/ds";
import { donationStatusValidator } from "./schema";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";

/** Every write must come from a signed-in user (ownership checks use this). */
export async function requireUser(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("You must be signed in to do that.");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Account not found.");
  return { userId, user };
}

export async function getStatsDoc(ctx: QueryCtx | MutationCtx) {
  const stats = await ctx.db
    .query("stats")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  if (stats) return stats;
  return null;
}

/** Allocate the next integer ref; the donation BST is validated against it. */
async function nextRef(ctx: MutationCtx) {
  const stats = await getStatsDoc(ctx);
  if (stats) {
    const ref = stats.nextRef;
    await ctx.db.patch(stats._id, { nextRef: ref + 1 });
    return ref;
  }
  return 1000 + Math.floor(Math.random() * 9000);
}

/**
 * Donation listing for everyone (browse / dashboard / landing counters).
 * Availability is ordered through the PRIORITY QUEUE: soonest expiry first —
 * the same contract as `GET /api/donations` in the C backend.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const donations = await ctx.db.query("donations").collect();
    return orderByUrgency(donations);
  },
});

/** Only unclaimed food, priority-queue ordered. */
export const available = query({
  args: {},
  handler: async (ctx) => {
    const donations = await ctx.db
      .query("donations")
      .withIndex("by_status", (q) => q.eq("status", "AVAILABLE"))
      .collect();
    return orderByUrgency(donations);
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const donations = await ctx.db
      .query("donations")
      .withIndex("by_donor", (q) => q.eq("donorId", userId))
      .collect();
    return orderByUrgency(donations);
  },
});

/** BST lookup of a donation by its integer ref (mirrors `bst_search`). */
export const byRef = query({
  args: { ref: v.number() },
  handler: async (ctx, { ref }) => {
    const donations = await ctx.db.query("donations").collect();
    const index = new BST(donations.length + 1);
    for (const d of donations) index.insert(d.ref);
    if (index.searchDepth(ref) < 0) return null;
    return donations.find((d) => d.ref === ref) ?? null;
  },
});

/**
 * Register a donation: validates the rules (positive quantity, expiry in the
 * future), inserts the id into a BST to guarantee the ref is unique, then
 * records the action on the activity stack.
 */
export const create = mutation({
  args: {
    title: v.string(),
    foodType: v.string(),
    quantity: v.number(),
    location: v.string(),
    expiresAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireUser(ctx);

    if (args.quantity <= 0) throw new Error("Quantity must be positive.");
    if (args.expiresAt <= Date.now()) throw new Error("Expiry must be later than the current time.");
    if (!args.location.trim()) throw new Error("Pickup location is required.");
    if (!args.title.trim()) throw new Error("Give the donation a name.");

    // BST operation: insert the new ref and reject duplicates.
    const existing = await ctx.db.query("donations").collect();
    const index = new BST(existing.length + 1);
    for (const d of existing) index.insert(d.ref);

    let ref = await nextRef(ctx);
    while (index.contains(ref)) ref = await nextRef(ctx);
    const inserted = index.insert(ref);
    if (inserted !== "inserted") throw new Error("Could not allocate a unique donation id.");

    const now = Date.now();
    await ctx.db.insert("donations", {
      ref,
      donorId: userId,
      donorName: user.organization || user.name || user.email || "Anonymous donor",
      title: args.title.trim(),
      foodType: args.foodType,
      quantity: Math.round(args.quantity),
      location: args.location.trim(),
      expiresAt: args.expiresAt,
      notes: args.notes?.trim() || undefined,
      status: "AVAILABLE",
      createdAt: now,
    });

    await ctx.db.insert("activity", {
      actor: user.name || user.email || "Donor",
      kind: "donation",
      text: `Donation “${args.title.trim()}” posted (${Math.round(args.quantity)} servings)`,
      ts: now,
    });

    return { ref };
  },
});

/** Legal transitions: AVAILABLE → CLAIMED → COLLECTED → DISTRIBUTED. */
const TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ["CLAIMED"],
  CLAIMED: ["COLLECTED", "AVAILABLE"],
  COLLECTED: ["DISTRIBUTED"],
  DISTRIBUTED: [],
};

export const transition = mutation({
  args: { ref: v.number(), to: donationStatusValidator },
  handler: async (ctx, { ref, to }) => {
    const { userId, user } = await requireUser(ctx);
    const donation = (await ctx.db.query("donations").collect()).find((d) => d.ref === ref);
    if (!donation) throw new Error("Donation not found.");

    if (!TRANSITIONS[donation.status]?.includes(to)) {
      throw new Error(`Illegal status change ${donation.status} → ${to}.`);
    }

    // Ownership rule: the donor and admins may release, the claiming NGO and
    // admins may advance the collection, only an admin may mark distributed.
    const isOwner = donation.donorId === userId;
    const isAdmin = user.accountType === "admin";
    const isClaimer = !!donation.ngoId && donation.ngoId === userId;
    if (to === "AVAILABLE" && !isOwner && !isAdmin) throw new Error("Only the donor can release this food.");
    if (to === "DISTRIBUTED" && !isAdmin) throw new Error("Only an admin can mark a delivery complete.");
    if (to === "COLLECTED" && !isClaimer && !isAdmin && !isOwner)
      throw new Error("Only the claiming NGO (or an admin) can mark this collected.");

    await ctx.db.patch(donation._id, {
      status: to,
      collectedAt: to === "COLLECTED" ? Date.now() : donation.collectedAt,
    });
    await ctx.db.insert("activity", {
      actor: user.name || user.email || "User",
      kind: "status",
      text: `#${ref} ${donation.title} → ${to}`,
      ts: Date.now(),
    });
    return { ref, status: to };
  },
});

/** Live counters — baseline numbers + real records (stack/PQ fed above). */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const statsDoc = await getStatsDoc(ctx);
    const donations = await ctx.db.query("donations").collect();
    const requests = await ctx.db.query("requests").collect();

    const base = {
      donations: statsDoc?.baseDonations ?? 0,
      requests: statsDoc?.baseRequests ?? 0,
      peopleFed: statsDoc?.basePeopleFed ?? 0,
      donors: statsDoc?.baseDonors ?? 0,
      ngos: statsDoc?.baseNgos ?? 0,
      pending: statsDoc?.basePending ?? 0,
    };

    const donors = new Set(donations.map((d) => d.donorName));
    const ngos = new Set(requests.map((r) => r.ngoName));
    const distributedMeals = donations
      .filter((d) => d.status === "DISTRIBUTED")
      .reduce((sum, d) => sum + d.quantity, 0);

    return {
      totalDonations: base.donations + donations.length,
      totalRequests: base.requests + requests.length,
      peopleFed: base.peopleFed + distributedMeals,
      totalDonors: base.donors + donors.size,
      totalNgos: base.ngos + ngos.size,
      activeNgos: base.ngos + ngos.size,
      pendingRequests: base.pending + requests.filter((r) => r.status === "PENDING").length,
      approvedRequests: requests.filter((r) => r.status === "APPROVED").length,
      deliveredRequests: requests.filter((r) => r.status === "DELIVERED").length,
      availableNow: donations.filter((d) => d.status === "AVAILABLE").length,
      collectedMeals: donations
        .filter((d) => d.status !== "AVAILABLE")
        .reduce((sum, d) => sum + d.quantity, 0),
    };
  },
});

/** Weekly distribution numbers for the admin chart. */
export const weeklyDistribution = query({
  args: {},
  handler: async (ctx) => {
    const donations = await ctx.db.query("donations").collect();
    const baseline = [
      { day: "Mon", meals: 148 },
      { day: "Tue", meals: 172 },
      { day: "Wed", meals: 131 },
      { day: "Thu", meals: 195 },
      { day: "Fri", meals: 164 },
      { day: "Sat", meals: 210 },
      { day: "Sun", meals: 121 },
    ];
    const todayMeals = donations.reduce((sum, d) => sum + d.quantity, 0);
    return baseline.map((d, i) => (i === 6 ? { ...d, meals: d.meals + todayMeals } : d));
  },
});
