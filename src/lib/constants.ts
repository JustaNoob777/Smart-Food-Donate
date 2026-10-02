/** Shared constants used by the frontend and the Convex backend. */

/** Delivery timeline — a linked list: each step points at the next. */
export const DELIVERY_STEPS = [
  "Request Received",
  "Assigned to Volunteer",
  "Picked Up",
  "Out for Delivery",
  "Delivered",
] as const;

export type DeliveryStep = (typeof DELIVERY_STEPS)[number];
