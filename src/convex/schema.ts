import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

/* Product-facing account types (which experience the user gets). */
export const ACCOUNT_TYPES = {
  DONOR: "donor",
  NGO: "ngo",
  ADMIN: "admin",
} as const;
export type AccountType = Infer<typeof accountTypeValidator>;
export const accountTypeValidator = v.union(
  v.literal(ACCOUNT_TYPES.DONOR),
  v.literal(ACCOUNT_TYPES.NGO),
  v.literal(ACCOUNT_TYPES.ADMIN),
);

/* Donation lifecycle — the only legal state machine in the system. */
export const DONATION_STATUSES = ["AVAILABLE", "CLAIMED", "COLLECTED", "DISTRIBUTED"] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];
export const donationStatusValidator = v.union(
  v.literal("AVAILABLE"),
  v.literal("CLAIMED"),
  v.literal("COLLECTED"),
  v.literal("DISTRIBUTED"),
);

export const REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED", "DELIVERED"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const requestStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("REJECTED"),
  v.literal("DELIVERED"),
);

/* Delivery timeline steps live in src/lib/constants.ts (shared with the UI). */

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      // product experience: donor posts food, ngo requests it, admin oversees
      accountType: v.optional(accountTypeValidator),
      organization: v.optional(v.string()),
      location: v.optional(v.string()),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Food donations. `ref` is the integer key stored in the BST index.
    donations: defineTable({
      ref: v.number(),
      donorId: v.string(),
      donorName: v.string(),
      title: v.string(),
      foodType: v.string(),
      quantity: v.number(), // servings / meals
      location: v.string(),
      expiresAt: v.number(),
      notes: v.optional(v.string()),
      status: donationStatusValidator,
      ngoId: v.optional(v.string()),
      ngoName: v.optional(v.string()),
      collectedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_donor", ["donorId"])
      .index("by_ref", ["ref"])
      .index("by_expiry", ["expiresAt"]),

    // Collection requests — served strictly FIFO by the backend.
    requests: defineTable({
      ref: v.number(),
      donationRef: v.number(),
      donationTitle: v.string(),
      ngoId: v.string(),
      ngoName: v.string(),
      quantity: v.number(),
      status: requestStatusValidator,
      step: v.number(), // index into DELIVERY_STEPS (linked-list node position)
      createdAt: v.number(),
    })
      .index("by_ngo", ["ngoId"])
      .index("by_status", ["status"])
      .index("by_donation", ["donationRef"]),

    // Recent actions — displayed LIFO from a stack.
    activity: defineTable({
      actor: v.string(),
      kind: v.string(),
      text: v.string(),
      ts: v.number(),
    }).index("by_ts", ["ts"]),

    // Counters + demo baseline numbers.
    stats: defineTable({
      key: v.string(),
      nextRef: v.number(),
      seeded: v.boolean(),
      baseDonations: v.number(),
      baseRequests: v.number(),
      basePeopleFed: v.number(),
      baseDonors: v.number(),
      baseNgos: v.number(),
      basePending: v.number(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
