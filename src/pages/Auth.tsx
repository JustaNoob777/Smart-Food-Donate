import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEMO_LOGIN_HINTS, demoSignIn, useSession } from "@/lib/session";
import { HeartHandshake, ShieldCheck, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps { redirectAfterAuth?: string }

function safeRedirect(value: string | null, fallback = "/dashboard") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export default function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const user = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = safeRedirect(params.get("returnTo"), redirectAfterAuth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) navigate(redirect, { replace: true });
  }, [user, navigate, redirect]);

  const signIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const session = demoSignIn(username, password);
    if (!session) {
      setError("Username or password is incorrect.");
      return;
    }
    navigate(redirect, { replace: true });
  };

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <section className="flex items-center justify-center p-5 sm:p-8">
        <Card className="w-full max-w-md rounded-[2rem] px-2 sm:px-4">
          <CardHeader className="pt-8 text-center">
            <button onClick={() => navigate("/")} aria-label="Back to home" className="mx-auto">
              <img src={logo} alt="FoodShare" width={64} height={64} className="rounded-2xl" />
            </button>
            <CardTitle className="mt-4 text-2xl font-extrabold">Sign in to FoodShare</CardTitle>
            <CardDescription>Choose one of the three local demo accounts.</CardDescription>
          </CardHeader>
          <form onSubmit={signIn}>
            <CardContent className="space-y-4 pb-8">
              <label className="block space-y-2 text-sm font-bold">
                Username
                <Input autoComplete="username" value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }} placeholder="donor, ngo, or admin" required />
              </label>
              <label className="block space-y-2 text-sm font-bold">
                Password
                <Input autoComplete="current-password" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} required />
              </label>
              {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
              <Button type="submit" className="w-full">Sign in</Button>

              <div className="space-y-2 pt-2">
                {DEMO_LOGIN_HINTS.map((account) => {
                  const Icon = account.username === "donor" ? Store : account.username === "ngo" ? HeartHandshake : ShieldCheck;
                  return (
                    <button key={account.username} type="button" onClick={() => { setUsername(account.username); setPassword(account.password); setError(""); }} className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:bg-muted/60">
                      <Icon className="size-4 shrink-0 text-primary" />
                      <span className="flex-1 text-sm font-bold">{account.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{account.username} / {account.password}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-center text-xs leading-5 text-muted-foreground">
                These shared demo credentials are stored only in this app and are not secure production accounts.
              </p>
            </CardContent>
          </form>
        </Card>
      </section>
      <aside className="hidden items-center justify-center bg-[#dce9d4] p-12 lg:flex">
        <div className="max-w-md"><span className="text-6xl">🥗</span><h2 className="mt-6 text-4xl font-black">Share food.<br />Move it smartly.</h2><p className="mt-4 text-lg leading-8 text-foreground/70">Donor, NGO, and admin sessions use separate identities while sharing the same C-powered donation board.</p></div>
      </aside>
    </main>
  );
}
