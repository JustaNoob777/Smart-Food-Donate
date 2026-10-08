import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useCEngine } from "@/hooks/use-c-engine";
import { cn } from "@/lib/utils";
import {
  Braces,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";

export const NAV_LINKS = [
  { to: "/dashboard", label: "Home" },
  { to: "/donate", label: "Donate" },
  { to: "/browse", label: "Request" },
  { to: "/track", label: "Track" },
  { to: "/ds", label: "Operations" },
  { to: "/c-demo", label: "C API" },
  { to: "/about", label: "About" },
] as const;

const ROLE_LABEL: Record<string, string> = {
  donor: "Donor",
  ngo: "NGO",
  admin: "Admin",
};

export function roleLabel(accountType?: string | null) {
  return accountType ? (ROLE_LABEL[accountType] ?? accountType) : "Guest";
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-full px-4 py-2 text-sm font-semibold transition-all",
    isActive
      ? "clay-inset text-foreground"
      : "text-muted-foreground hover:text-foreground hover:bg-secondary/70",
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={navLinkClass}
          onClick={onNavigate}
        >
          {link.label}
        </NavLink>
      ))}
    </>
  );
}

function UserMenu() {
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const navigate = useNavigate();

  if (isLoading)
    return <div className="size-10 rounded-full bg-muted shadow-inner" />;

  if (!isAuthenticated) {
    return (
      <Button
        className="clay-btn gap-2"
        onClick={() => navigate("/auth?returnTo=/dashboard")}
      >
        <UserRound className="size-4" />
        Sign in
      </Button>
    );
  }

  const name = user?.name || user?.email?.split("@")[0] || "Friend";
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="clay-soft flex items-center gap-2 py-1.5 pr-4 pl-1.5 transition-transform active:scale-95"
          aria-label="Open account menu"
        >
          <span className="clay-tile-amber grid size-8 place-items-center rounded-full text-xs font-extrabold text-[#3a2a10]">
            {initials}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-28 truncate text-sm font-bold">
              {name}
            </span>
            <span className="block text-[11px] font-semibold text-muted-foreground">
              {roleLabel(user?.accountType)}
            </span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {user?.email ?? "Signed in"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/dashboard")}>
          <LayoutDashboard className="mr-2 size-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <UserRound className="mr-2 size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Shared site footer — also used by the public landing page. */
export function AppFooter() {
  return (
    <footer className="mt-16 px-4 pb-8">
      <div className="clay mx-auto w-full max-w-7xl rounded-[1.75rem] px-6 py-8 sm:px-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src={logo}
                alt="FoodShare"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="font-extrabold">FoodShare</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Connecting surplus food with the people who need it — reducing
              waste, one priority-queue insertion at a time.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link className="hover:text-foreground" to="/donate">
                  Donate food
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" to="/browse">
                  Request food
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" to="/track">
                  Track deliveries
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" to="/profile">
                  Profile
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold">Data structures</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link className="hover:text-foreground" to="/ds?tab=stack">
                  Stack · history
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" to="/ds?tab=queue">
                  Queue · requests
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" to="/ds?tab=pq">
                  Priority queue · expiry
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" to="/ds?tab=deque">
                  Deque · dispatch
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" to="/ds?tab=bst">
                  BST · id lookup
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold">Project</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link className="hover:text-foreground" to="/about">
                  About FoodShare
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" to="/ds">
                  FoodShare operations
                </Link>
              </li>
              <li>
                <Link className="hover:text-foreground" to="/c-demo">
                  C backend status
                </Link>
              </li>
              <li>
                <span className="text-muted-foreground">
                  SDG 2 · Zero Hunger
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-border/70 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Backend in C (stack · queue · deque · priority queue · linked list · AVL tree · graph)
          </span>
          <span>React interface · native C API · local demo</span>
        </div>
      </div>
    </footer>
  );
}

/** Floating claymorphism navbar + footer shared by every signed-in page. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
        <nav className="clay mx-auto flex w-full max-w-7xl items-center gap-2 rounded-[1.5rem] px-3 py-2.5 sm:px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <img
              src={logo}
              alt="FoodShare"
              width={36}
              height={36}
              className="rounded-xl"
            />
            <span className="hidden leading-tight sm:block">
              <span className="block text-base font-extrabold tracking-tight">
                FoodShare
              </span>
              <span className="block text-[10px] font-semibold text-muted-foreground">
                C Data Structures · FoodShare
              </span>
            </span>
          </Link>

          <div className="mx-auto hidden items-center gap-1 lg:flex">
            <NavLinks />
          </div>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <UserMenu />
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="rounded-l-[1.75rem]">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="mt-6 flex flex-col gap-2">
                  <NavLink
                    to="/"
                    className={navLinkClass}
                    onClick={() => setMenuOpen(false)}
                  >
                    Landing
                  </NavLink>
                  <NavLinks onNavigate={() => setMenuOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <COperationFeed />

      <AppFooter />
    </div>
  );
}

/** Live evidence that product actions execute the compiled C engine. */
function COperationFeed() {
  const { engine, status } = useCEngine();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!engine) return;
    const refresh = () => setLines(engine.trace().slice(-8));
    refresh();
    const timer = window.setInterval(refresh, 400);
    return () => window.clearInterval(timer);
  }, [engine]);

  return (
    <aside className="fixed right-4 bottom-4 z-50 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#314237] bg-[#17231c] text-[#efe6d6] shadow-xl">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-bold">
          <Braces className="size-4 text-[#9fc58d]" />C engine ·{" "}
          {status === "ready" ? "live operations" : status}
        </span>
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="max-h-56 space-y-1 overflow-y-auto border-t border-white/10 px-4 py-3 font-mono text-[10px] leading-5">
          <p className="mb-2 font-sans text-[11px] text-[#a9b8aa]">
            Operations from donation, request, and delivery actions run in ds.c
            via WebAssembly.
          </p>
          {lines.length ? (
            lines.map((line, index) => (
              <p key={`${index}-${line}`} className="break-words">
                <span className="text-[#9fc58d]">›</span> {line}
              </p>
            ))
          ) : (
            <p className="text-[#a9b8aa]">
              Use Donate, Request, or Track to see C operations.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
