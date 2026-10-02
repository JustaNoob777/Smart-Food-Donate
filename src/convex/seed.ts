import { v } from "convex/values";
import { mutation } from "./_generated/server";

const H = 60 * 60 * 1000;

/**
 * Baseline counters so the dashboard shows realistic network totals, plus a
 * demo dataset on an empty deployment. Idempotent: safe to call on every load.
 */
export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("stats")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    if (!existing) {
      await ctx.db.insert("stats", {
        key: "global",
        nextRef: 1009,
        seeded: false,
        // 240 + 8 demo rows = 248 total donations
        baseDonations: 240,
        // 32 + 4 demo rows = 36 requests
        baseRequests: 32,
        // 1170 + 60 distributed demo meals = 1,230 people fed
        basePeopleFed: 1170,
        // 35 + 7 distinct demo donors = 42
        baseDonors: 35,
        // 53 + 3 distinct demo NGOs = 56
        baseNgos: 53,
        // 16 + 2 demo pending = 18 pending requests
        basePending: 16,
      });
    }

    const donations = await ctx.db.query("donations").collect();
    if (donations.length > 0) return { seeded: true };

    const now = Date.now();
    const demo = [
      { ref: 1001, title: "Cooked Rice + Curry", foodType: "Cooked Food", quantity: 20, location: "Kozhikode", expiresAt: now + 6 * H, status: "AVAILABLE" as const, donorName: "Sunshine Restaurant", notes: "Freshly cooked rice with vegetable curry." },
      { ref: 1002, title: "Vegetable Pack", foodType: "Fresh Produce", quantity: 50, location: "Vadakara", expiresAt: now + 26 * H, status: "CLAIMED" as const, donorName: "Green Bistro", ngoName: "Hope Foundation", notes: "Assorted seasonal vegetables." },
      { ref: 1003, title: "Bread & Snacks", foodType: "Bakery", quantity: 30, location: "Calicut", expiresAt: now + 48 * H, status: "AVAILABLE" as const, donorName: "Daily Bakes", notes: "End-of-day bread, buns and savouries." },
      { ref: 1004, title: "Fruit Boxes", foodType: "Fresh Produce", quantity: 40, location: "Feroke", expiresAt: now + 9 * H, status: "COLLECTED" as const, donorName: "Sunshine Restaurant", ngoName: "Hope Foundation", notes: "Bananas, apples and oranges." },
      { ref: 1005, title: "Rice Sambar Meals", foodType: "Cooked Food", quantity: 35, location: "Kozhikode", expiresAt: now + 90 * 60 * 1000, status: "AVAILABLE" as const, donorName: "Home Kitchen", notes: "Hot meals packed for same-day pickup." },
      { ref: 1006, title: "Milk & Cereals", foodType: "Packaged", quantity: 60, location: "Beypore", expiresAt: now + 72 * H, status: "DISTRIBUTED" as const, donorName: "Mega Mart", ngoName: "Rise Together", notes: "Shelf-stable milk and cereal packs." },
      { ref: 1007, title: "Roti & Paneer Curry", foodType: "Cooked Food", quantity: 25, location: "Thalassery", expiresAt: now + 4 * H, status: "AVAILABLE" as const, donorName: "Spice Garden", notes: "Warm rotis with paneer curry." },
      { ref: 1008, title: "Seafood Fried Rice", foodType: "Cooked Food", quantity: 45, location: "Kozhikode", expiresAt: now + 12 * H, status: "CLAIMED" as const, donorName: "Ocean Kitchen", ngoName: "Community Fridge", notes: "Packed portions, keep refrigerated." },
    ];

    const ngoIdByOrg: Record<string, string> = {
      "Hope Foundation": "seed-ngo-hope",
      "Rise Together": "seed-ngo-rise",
      "Community Fridge": "seed-ngo-fridge",
    };

    for (const d of demo) {
      await ctx.db.insert("donations", {
        ref: d.ref,
        donorId: `seed-donor-${d.donorName}`,
        donorName: d.donorName,
        title: d.title,
        foodType: d.foodType,
        quantity: d.quantity,
        location: d.location,
        expiresAt: d.expiresAt,
        notes: d.notes,
        status: d.status,
        ngoId: d.ngoName ? ngoIdByOrg[d.ngoName] : undefined,
        ngoName: d.ngoName,
        createdAt: now - (d.ref - 1001) * 37 * 60 * 1000,
      });
    }

    const reqs: Array<{
      ref: number;
      donationRef: number;
      donationTitle: string;
      ngoName: string;
      quantity: number;
      status: "PENDING" | "APPROVED" | "DELIVERED";
      step: number;
      minutesAgo: number;
    }> = [
      { ref: 5001, donationRef: 1002, donationTitle: "Vegetable Pack", ngoName: "Hope Foundation", quantity: 50, status: "PENDING", step: 0, minutesAgo: 24 },
      { ref: 5002, donationRef: 1004, donationTitle: "Fruit Boxes", ngoName: "Hope Foundation", quantity: 40, status: "APPROVED", step: 2, minutesAgo: 96 },
      { ref: 5003, donationRef: 1006, donationTitle: "Milk & Cereals", ngoName: "Rise Together", quantity: 60, status: "DELIVERED", step: 4, minutesAgo: 300 },
      { ref: 5004, donationRef: 1008, donationTitle: "Seafood Fried Rice", ngoName: "Community Fridge", quantity: 45, status: "PENDING", step: 0, minutesAgo: 8 },
    ];

    for (const r of reqs) {
      await ctx.db.insert("requests", {
        ref: r.ref,
        donationRef: r.donationRef,
        donationTitle: r.donationTitle,
        ngoId: ngoIdByOrg[r.ngoName],
        ngoName: r.ngoName,
        quantity: r.quantity,
        status: r.status,
        step: r.step,
        createdAt: now - r.minutesAgo * 60 * 1000,
      });
    }

    const activity: Array<{ actor: string; kind: string; text: string; minutesAgo: number }> = [
      { actor: "Rise Together", kind: "delivery", text: "Milk & Cereals delivered to 60 recipients", minutesAgo: 3 },
      { actor: "Admin", kind: "approval", text: "Request #5002 approved for Fruit Boxes", minutesAgo: 90 },
      { actor: "Hope Foundation", kind: "delivery", text: "#5002 reached “Picked Up”", minutesAgo: 88 },
      { actor: "Ocean Kitchen", kind: "donation", text: "Donation “Seafood Fried Rice” posted (45 servings)", minutesAgo: 40 },
      { actor: "Community Fridge", kind: "request", text: "Requested “Seafood Fried Rice” — enqueued (FIFO)", minutesAgo: 8 },
      { actor: "Sunshine Restaurant", kind: "donation", text: "Donation “Cooked Rice + Curry” posted (20 servings)", minutesAgo: 210 },
    ];
    for (const a of activity) {
      await ctx.db.insert("activity", {
        actor: a.actor,
        kind: a.kind,
        text: a.text,
        ts: now - a.minutesAgo * 60 * 1000,
      });
    }

    const stats = await ctx.db
      .query("stats")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (stats) await ctx.db.patch(stats._id, { seeded: true });

    return { seeded: true };
  },
});
