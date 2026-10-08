import { useSyncExternalStore } from "react";

export type DemoUser = {
  _id: string;
  name: string;
  email: string;
  image?: string;
  isAnonymous: true;
  accountType: "donor" | "ngo" | "admin";
  role: "user" | "member" | "admin";
  organization: string;
  location: string;
};

const DEMO_ACCOUNTS = {
  donor: { username: "donor", password: "donor123", name: "Donor", id: "demo-donor", accountType: "donor", organization: "Community Kitchen" },
  ngo: { username: "ngo", password: "ngo123", name: "NGO", id: "demo-ngo", accountType: "ngo", organization: "Community NGO" },
  admin: { username: "admin", password: "admin123", name: "Admin", id: "demo-admin", accountType: "admin", organization: "FoodShare" },
} as const;

const STORAGE_KEY = "foodshare-demo-profile";
const listeners = new Set<() => void>();
let current: DemoUser | null = readSession();

function readSession(): DemoUser | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as DemoUser;
    if (session._id === "local-demo-user") {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function getSession() {
  return current;
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSession() {
  return useSyncExternalStore(subscribeSession, getSession, () => null);
}

export function demoSignIn(username: string, password: string) {
  const account = Object.values(DEMO_ACCOUNTS).find(
    (candidate) => candidate.username === username.trim().toLowerCase() && candidate.password === password,
  );
  if (!account) return null;
  const accountType = account.accountType;
  current = {
    _id: account.id,
    name: account.name,
    email: `${account.username}@foodshare.local`,
    isAnonymous: true,
    accountType,
    role: accountType === "admin" ? "admin" : accountType === "ngo" ? "member" : "user",
    organization: account.organization,
    location: "Kozhikode",
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* demo can still run in private mode */ }
  emit();
  return current;
}

export const DEMO_LOGIN_HINTS = Object.values(DEMO_ACCOUNTS).map(({ username, password, name }) => ({ username, password, name }));

export function updateDemoSession(patch: Partial<DemoUser>) {
  if (!current) return null;
  current = { ...current, ...patch };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* keep in-memory session */ }
  emit();
  return current;
}

export function endDemoSession() {
  current = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore storage restrictions */ }
  emit();
}
