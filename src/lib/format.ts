/** Small display helpers shared by the pages. */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}

export interface ExpiryInfo {
  label: string;
  minutesLeft: number;
  expired: boolean;
  urgent: boolean;
}

export function expiryInfo(expiresAt: number): ExpiryInfo {
  const diff = expiresAt - Date.now();
  const minutesLeft = Math.max(0, Math.round(diff / MINUTE));
  if (diff <= 0) return { label: "Expired", minutesLeft: 0, expired: true, urgent: true };
  if (diff < HOUR) return { label: `Expires in ${minutesLeft} min`, minutesLeft, expired: false, urgent: true };
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    const m = Math.floor((diff % HOUR) / MINUTE);
    return { label: `Expires in ${h}h ${m}m`, minutesLeft, expired: false, urgent: diff < 4 * HOUR };
  }
  const d = Math.floor(diff / DAY);
  return { label: `Expires in ${d} day${d > 1 ? "s" : ""}`, minutesLeft, expired: false, urgent: false };
}

export function foodEmoji(foodType: string): string {
  const t = foodType.toLowerCase();
  if (t.includes("cook") || t.includes("meal") || t.includes("rice")) return "🍲";
  if (t.includes("bread") || t.includes("bakery") || t.includes("snack")) return "🥖";
  if (t.includes("vegetable") || t.includes("produce") || t.includes("fruit")) return "🥕";
  if (t.includes("packaged") || t.includes("milk") || t.includes("cereal")) return "🥫";
  if (t.includes("fruit")) return "🍎";
  return "🍽️";
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: "bg-[#dce9d4] text-[#37452e]",
  CLAIMED: "bg-[#fdecc8] text-[#7a5410]",
  COLLECTED: "bg-[#dbe7f7] text-[#2c4a77]",
  DISTRIBUTED: "bg-[#d5ead0] text-[#2f5224]",
  PENDING: "bg-[#fdecc8] text-[#7a5410]",
  APPROVED: "bg-[#dbe7f7] text-[#2c4a77]",
  REJECTED: "bg-[#fadbd5] text-[#8a382b]",
  DELIVERED: "bg-[#d5ead0] text-[#2f5224]",
};

export function statusClass(status: string): string {
  return STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
}
