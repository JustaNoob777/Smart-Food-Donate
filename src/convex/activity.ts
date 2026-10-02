import { v } from "convex/values";
import { Stack } from "../lib/ds";
import { query } from "./_generated/server";

/**
 * Recent actions, newest first. The rows are pushed onto a STACK and popped
 * back off, which is exactly how the C backend serves `GET /api/history`.
 */
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("activity").withIndex("by_ts").order("asc").collect();
    const stack = new Stack<(typeof rows)[number]>();
    for (const row of rows) stack.push(row);

    const out: (typeof rows)[number][] = [];
    const max = limit ?? 8;
    while (out.length < max && !stack.isEmpty()) {
      const row = stack.pop();
      if (row) out.push(row);
    }
    return out;
  },
});
