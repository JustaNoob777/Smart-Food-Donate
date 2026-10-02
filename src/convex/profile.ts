import { v } from "convex/values";
import { accountTypeValidator } from "./schema";
import { requireUser } from "./donations";
import { mutation } from "./_generated/server";

const LABELS: Record<string, string> = { donor: "Donor", ngo: "NGO / Recipient", admin: "Admin" };

/** Update your own profile — including which role experience you use. */
export const update = mutation({
  args: {
    name: v.optional(v.string()),
    organization: v.optional(v.string()),
    location: v.optional(v.string()),
    accountType: v.optional(accountTypeValidator),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireUser(ctx);

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.organization !== undefined) patch.organization = args.organization.trim();
    if (args.location !== undefined) patch.location = args.location.trim();

    if (args.accountType && args.accountType !== user.accountType) {
      patch.accountType = args.accountType;
      patch.role = args.accountType === "admin" ? "admin" : args.accountType === "ngo" ? "member" : "user";
      await ctx.db.insert("activity", {
        actor: user.name || user.email || "User",
        kind: "role",
        text: `Switched profile to ${LABELS[args.accountType]}`,
        ts: Date.now(),
      });
    }

    if (Object.keys(patch).length > 0) await ctx.db.patch(userId, patch);
    return { ok: true };
  },
});
