import { api } from "@/lib/api";
import { AppShell, roleLabel } from "@/components/AppShell";
import { ClayBadge, PageHeader } from "@/components/ui-clay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import {
  BellRing,
  HelpCircle,
  KeyRound,
  Lock,
  Save,
  UserRound,
} from "lucide-react";
import { useMutation } from "@/lib/c-api";
import { useState } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const update = useMutation(api.profile.update);
  const [busy, setBusy] = useState(false);
  const [notif, setNotif] = useState({ near: true, claimed: true, digest: false });

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await update({
        name: String(form.get("name") ?? "").trim(),
        organization: String(form.get("organization") ?? "").trim(),
        location: String(form.get("location") ?? "").trim(),
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the profile");
    } finally {
      setBusy(false);
    }
  };

  const initials = (user?.name || user?.email || "F")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <PageHeader
          title="Profile & settings"
          subtitle="Update your local demo profile. Sign out from the account menu to choose a different demo login."
        />

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* ----------------------------- form ----------------------------- */}
          <form onSubmit={onSubmit} className="clay p-6 sm:p-8">
            <h3 className="font-extrabold">Profile information</h3>
            <p className="text-xs text-muted-foreground">
              Used to label donations and requests in this local demo.
            </p>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" name="name" defaultValue={user?.name ?? ""} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ""} disabled className="opacity-70" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  name="organization"
                  defaultValue={user?.organization ?? ""}
                  placeholder="e.g. Hope Foundation / Sunshine Restaurant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  defaultValue={user?.location ?? ""}
                  placeholder="e.g. Kozhikode"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Signed-in demo account</Label>
                <div className="clay-inset flex items-center gap-3 px-4 py-3">
                  <UserRound className="size-4 text-primary" />
                  <span className="text-sm font-bold">{roleLabel(user?.accountType)}</span>
                  <span className="text-xs text-muted-foreground">Sign out to switch accounts.</span>
                </div>
              </div>
            </div>

            <Button type="submit" disabled={busy} className="mt-6 gap-1.5">
              <Save className="size-4" />
              {busy ? "Saving…" : "Update profile"}
            </Button>
          </form>

          {/* ------------------------- side column -------------------------- */}
          <aside className="space-y-6">
            <div className="clay p-6 text-center">
              <div className="clay-tile-amber mx-auto grid size-24 place-items-center rounded-full text-3xl font-extrabold text-[#3a2a10] shadow-lg">
                {initials}
              </div>
              <h3 className="mt-4 text-xl font-extrabold">{user?.name || "FoodShare friend"}</h3>
              <p className="text-sm font-semibold text-muted-foreground">{user?.email ?? "—"}</p>
              <div className="mt-3 flex justify-center">
                <ClayBadge className="bg-[#dbe7f7] text-[#2c4a77]">
                  <UserRound className="size-3" /> {roleLabel(user?.accountType)}
                </ClayBadge>
              </div>
              <div className="clay-inset mt-4 px-4 py-3 text-left">
                <p className="text-xs font-bold text-muted-foreground">Account id</p>
                <p className="truncate font-mono text-[11px] font-semibold">
                  {user?._id ?? "—"}
                </p>
              </div>
            </div>

            <div className="clay p-6">
              <div className="flex items-center gap-2">
                <BellRing className="size-4 text-[#c07f1d]" />
                <h3 className="font-extrabold">Notifications</h3>
              </div>
              <div className="mt-4 space-y-3.5">
                {[
                  { key: "near" as const, label: "Food nearing expiry" },
                  { key: "claimed" as const, label: "Requests claimed / delivered" },
                  { key: "digest" as const, label: "Weekly impact digest" },
                ].map((row) => (
                  <label key={row.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{row.label}</span>
                    <Switch
                      checked={notif[row.key]}
                      onCheckedChange={(v) => setNotif((s) => ({ ...s, [row.key]: v }))}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="clay p-6">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-[#4a7a38]" />
                <h3 className="font-extrabold">Security & help</h3>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <p className="clay-inset flex items-center gap-2 px-4 py-3">
                  <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-semibold">Shared local demo credentials</span>
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <HelpCircle className="size-4 shrink-0" />
                  Demo passwords are visible in the app and are not for real accounts.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
