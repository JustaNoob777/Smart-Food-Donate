import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type ClayTone = "amber" | "sage" | "sky" | "coral";

const TILE: Record<ClayTone, string> = {
  amber: "clay-tile-amber text-[#5a3d0c]",
  sage: "clay-tile-sage text-[#2f4a26]",
  sky: "clay-tile-sky text-[#274066]",
  coral: "clay-tile-coral text-[#6d2f24]",
};

const WRAP: Record<ClayTone, string> = {
  amber: "hover:-translate-y-1",
  sage: "hover:-translate-y-1",
  sky: "hover:-translate-y-1",
  coral: "hover:-translate-y-1",
};

/** Plush stat tile: inflated icon blob + oversized number. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "amber",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: ClayTone;
}) {
  return (
    <div className={cn("clay-soft flex items-start gap-4 p-5 transition-transform", WRAP[tone])}>
      <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", TILE[tone])}>
        <Icon className="size-5" strokeWidth={2.5} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Rounded pill badge used for statuses across the app. */
export function ClayBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Page heading with a soft subtitle. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
