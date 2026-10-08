import logo from "@/assets/logo.svg";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router";

/** Floating clay navbar for public pages (landing, about). */
export default function PublicHeader() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <nav className="clay mx-auto flex w-full max-w-7xl items-center gap-2 rounded-[1.5rem] px-3 py-2.5 sm:px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img src={logo} alt="FoodShare" width={36} height={36} className="rounded-xl" />
          <span className="hidden leading-tight sm:block">
            <span className="block text-base font-extrabold tracking-tight">FoodShare</span>
            <span className="block text-[10px] font-semibold text-muted-foreground">
              Share Food · Share Hope
            </span>
          </span>
        </Link>

        <div className="mx-auto hidden items-center gap-1 md:flex">
          <a
            href="/#features"
            className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-all hover:bg-secondary/70 hover:text-foreground"
          >
            Features
          </a>
          <Link
            to="/ds"
            className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-all hover:bg-secondary/70 hover:text-foreground"
          >
            Operations
          </Link>
          <Link
            to="/c-demo"
            className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-all hover:bg-secondary/70 hover:text-foreground"
          >
            C API status
          </Link>
          <Link
            to="/about"
            className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-all hover:bg-secondary/70 hover:text-foreground"
          >
            About
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <button
            className="clay-btn-ghost px-3 py-2 text-sm font-bold sm:px-4"
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth?returnTo=/dashboard")}
          >
            {isAuthenticated ? "Home" : "Sign in"}
          </button>
          <button
            className="clay-btn px-4 py-2 text-sm font-bold"
            onClick={() => navigate(isAuthenticated ? "/donate" : "/auth?returnTo=/donate")}
          >
            {isAuthenticated ? "Donate" : "Get started"}
          </button>
        </div>
      </nav>
    </header>
  );
}
