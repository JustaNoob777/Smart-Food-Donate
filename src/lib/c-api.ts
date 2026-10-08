/* The existing screens consume several different query shapes through this
 * small REST adapter. Keep the adapter boundary dynamic instead of spreading
 * duplicate structural types through every screen. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getSession, subscribeSession, updateDemoSession } from "./session";

const API_URL = (import.meta.env.VITE_C_API_URL || "http://localhost:8080").replace(/\/$/, "");

async function request(path: string, body?: unknown): Promise<any> {
  const response = await fetch(`${API_URL}${path}`, body === undefined ? undefined : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `C backend returned ${response.status}`);
  return payload;
}

function donation(row: any) {
  const expiresAt = row.expiresAt ?? Date.now() + Number(row.expires_in_minutes ?? 0) * 60_000;
  return {
    ...row,
    _id: row._id ?? `donation-${row.ref ?? row.id}`,
    ref: row.ref ?? row.id,
    donorId: row.donorId ?? "local-demo-user",
    donorName: row.donorName ?? "Community donor",
    foodType: row.foodType ?? "Other",
    expiresAt,
    createdAt: row.createdAt ?? Date.now(),
  };
}

function requestRow(row: any, index: number) {
  return {
    ...row,
    _id: row._id ?? `request-${row.ref ?? row.id}`,
    ref: row.ref ?? row.id,
    donationRef: row.donationRef ?? row.donation_id,
    donationTitle: row.donationTitle ?? `Donation #${row.donationRef ?? row.donation_id}`,
    ngoId: row.ngoId ?? "local-demo-user",
    ngoName: row.ngoName ?? "Community NGO",
    step: row.step ?? 0,
    createdAt: row.createdAt ?? Date.now() - index * 60_000,
  };
}

async function queryBackend(ref: string, args?: any, user = getSession()): Promise<any> {
  switch (ref) {
    case "users.currentUser": return user;
    case "donations.list":
    case "donations.available": {
      const rows = (await request("/api/donations")).map(donation);
      return ref.endsWith("available") ? rows.filter((row: any) => row.status === "AVAILABLE") : rows;
    }
    case "donations.mine":
      return (await request("/api/donations")).map(donation).filter((row: any) =>
        row.donorId === user?._id || (user?.accountType === "donor" && row.donorId === "local-demo-user"),
      );
    case "donations.stats": return request("/api/stats");
    case "donations.weeklyDistribution": return request("/api/stats/weekly");
    case "requests.list":
    case "requests.mine": {
      const rows = (await request("/api/requests")).map(requestRow);
      return ref.endsWith("mine") ? rows.filter((row: any) =>
        row.ngoId === user?._id || (user?.accountType === "ngo" && row.ngoId === "local-demo-user"),
      ) : rows;
    }
    case "requests.pendingQueue": {
      const [requests, dispatch] = await Promise.all([
        request("/api/requests"), request("/api/dispatch"),
      ]);
      const dispatchOrder = new Map<number, number>(dispatch.map((row: any) => [row.id, row.dispatch_position] as [number, number]));
      return requests.map(requestRow)
        .filter((row: any) => row.status === "PENDING")
        .sort((a: any, b: any) => (dispatchOrder.get(a.id) ?? 9999) - (dispatchOrder.get(b.id) ?? 9999))
        .map((row: any, position: number) => ({ ...row, position }));
    }
    case "activity.recent": {
      const limit = Number(args?.limit ?? 8);
      return (await request("/api/history")).slice(0, limit).map((row: any, index: number) => ({
        _id: `activity-${row.code}-${index}`, actor: "FoodShare", kind: "operation",
        text: row.action, ts: Date.now() - index * 60_000,
      }));
    }
    default: throw new Error(`Unsupported C query: ${ref}`);
  }
}

async function mutateBackend(ref: string, args: any): Promise<any> {
  const user = getSession();
  switch (ref) {
    case "profile.update": {
      updateDemoSession({ name: args.name, organization: args.organization, location: args.location });
      return { ok: true };
    }
    case "donations.create": {
      const result = await request("/api/donations", {
        title: args.title, foodType: args.foodType, quantity: args.quantity,
        location: args.location, expires_in: Math.max(1, Math.ceil((args.expiresAt - Date.now()) / 60_000)),
        notes: args.notes ?? "", donor_id: user?._id ?? "local-demo-user",
        donor_name: user?.organization || user?.name || "Community donor",
      });
      return { ref: result.ref ?? result.id };
    }
    case "requests.create": {
      const result = await request("/api/requests", {
        donation_id: args.donationRef, ngo_id: 1, quantity: args.quantity,
        ngo_name: user?.organization || user?.name || "Community NGO",
        ngo_ref: user?._id ?? "local-demo-user",
        account_type: user?.accountType ?? "donor",
      });
      return { ref: result.ref ?? result.id };
    }
    case "requests.approve": return request("/api/requests/approve", { ...args, account_type: user?.accountType });
    case "requests.advanceStep": return request("/api/requests/advance", { ...args, account_type: user?.accountType });
    default: throw new Error(`Unsupported C operation: ${ref}`);
  }
}

/** Data query hook backed by short polling against the local C API. */
type QueryValue = any[] & Record<string, any>;

export function useQuery(ref: string, args?: any): QueryValue {
  const [value, setValue] = useState<any>(undefined);
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const argsKey = JSON.stringify(args ?? {});
  const load = useCallback(() => {
    void queryBackend(ref, JSON.parse(argsKey), session).then(setValue).catch((error) => {
      console.warn(`[C API] ${ref}:`, error.message);
    });
  }, [ref, argsKey, session]);

  useEffect(() => {
    load();
    window.addEventListener("foodshare:data-changed", load);
    const timer = window.setInterval(load, 2500);
    return () => {
      window.removeEventListener("foodshare:data-changed", load);
      window.clearInterval(timer);
    };
  }, [load]);
  return value as QueryValue;
}

/** Mutation hook backed by one C HTTP operation. */
export function useMutation(ref: string): (args?: any) => Promise<any> {
  return useCallback(async (args?: any) => {
    const result = await mutateBackend(ref, args ?? {});
    window.dispatchEvent(new Event("foodshare:data-changed"));
    return result;
  }, [ref]);
}
