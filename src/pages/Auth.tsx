import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowRight, HeartHandshake, Loader2, Mail, Store, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

const ROLE_CHIPS = [
  { role: "donor", label: "I'm a donor", icon: Store },
  { role: "ngo", label: "I'm an NGO", icon: HeartHandshake },
] as const;

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const activeRole = redirect.includes("role=ngo")
    ? "ngo"
    : redirect.includes("role=donor")
      ? "donor"
      : null;

  const pickRole = (role: string) => {
    navigate(`/auth?returnTo=${encodeURIComponent(`/dashboard?role=${role}`)}`, {
      replace: true,
    });
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("The verification code you entered is incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ------------------------------ form ------------------------------ */}
      <div className="flex items-center justify-center p-5 sm:p-8">
        <Card className="w-full max-w-md rounded-[2rem] px-2 pb-0 sm:px-4">
          {step === "signIn" ? (
            <>
              <CardHeader className="pt-8 text-center">
                <div className="flex justify-center">
                  <button onClick={() => navigate("/")} aria-label="Back to home">
                    <img
                      src={logo}
                      alt="FoodShare"
                      width={64}
                      height={64}
                      className="rounded-2xl"
                    />
                  </button>
                </div>
                <CardTitle className="mt-4 text-2xl font-extrabold">Welcome back!</CardTitle>
                <CardDescription>
                  Login to continue to FoodShare — share food, share hope.
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleEmailSubmit}>
                <CardContent>
                  <div className="clay-soft mb-4 flex gap-2 p-1.5">
                    {ROLE_CHIPS.map((chip) => (
                      <button
                        key={chip.role}
                        type="button"
                        onClick={() => pickRole(chip.role)}
                        className={
                          "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all " +
                          (activeRole === chip.role
                            ? "clay-inset text-foreground"
                            : "text-muted-foreground hover:text-foreground")
                        }
                      >
                        <chip.icon className="size-3.5" />
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        className="pl-9"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <Button type="submit" variant="outline" size="icon" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

                  <div className="mt-5">
                    <div className="relative flex items-center gap-2">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        or
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 w-full"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Continue as Guest
                    </Button>
                  </div>
                </CardContent>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="pt-8 text-center">
                <CardTitle className="text-xl font-extrabold">Check your email</CardTitle>
                <CardDescription>We&apos;ve sent a code to {step.email}</CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="pb-4">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) form.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="mt-2 text-center text-sm text-destructive">{error}</p>
                  )}
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Didn&apos;t receive a code?{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => setStep("signIn")}
                    >
                      Try again
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify code
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep("signIn")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Use different email
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          <div className="rounded-b-[1.75rem] bg-muted px-6 py-4 text-center text-xs text-muted-foreground">
            Secured by{" "}
            <a
              href="https://freebuff.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline hover:text-foreground"
            >
              freebuff.com
            </a>
          </div>
        </Card>
      </div>

      {/* ---------------------------- illustration ---------------------------- */}
      <div className="clay-tile-amber relative hidden overflow-hidden rounded-l-[2.5rem] p-10 lg:flex lg:items-center">
        <div className="absolute -top-16 -right-10 size-64 rounded-full bg-white/30 blur-2xl" />
        <div className="absolute -bottom-20 -left-12 size-72 rounded-full bg-[#7fb069]/40 blur-2xl" />
        <div className="absolute top-14 left-12 text-5xl">🥗</div>
        <div className="absolute right-16 bottom-24 text-5xl">🍲</div>
        <div className="absolute top-1/2 right-10 text-4xl">📦</div>

        <div className="relative mx-auto max-w-md">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3.5 py-1.5 text-xs font-extrabold text-[#5a3d0c] shadow-sm">
            <HeartHandshake className="size-3.5" /> Together against hunger
          </p>
          <h2 className="mt-5 text-4xl leading-tight font-extrabold text-[#4a3210]">
            Good food.
            <br />
            Better tomorrow.
          </h2>
          <p className="mt-4 text-sm leading-6 font-semibold text-[#6b4d1d]">
            Every donation is sorted by expiry, queued by fairness and routed by the
            shortest caring path — powered by a backend written in C.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { v: "248", l: "donations" },
              { v: "1,230", l: "people fed" },
              { v: "56", l: "NGOs" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-white/70 px-3 py-3 text-center shadow-sm">
                <p className="text-xl font-extrabold text-[#4a3210] tabular-nums">{s.v}</p>
                <p className="text-[10px] font-bold text-[#8a6a33] uppercase">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
