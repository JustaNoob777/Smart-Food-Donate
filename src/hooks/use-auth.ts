import { endDemoSession, useSession } from "@/lib/session";

export function useAuth() {
  const user = useSession();
  return {
    isLoading: false,
    isAuthenticated: user !== null,
    user,
    signOut: async () => endDemoSession(),
  };
}
