import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: Enums<"app_role"> | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

const ROLE_FETCH_TIMEOUT_MS = 8000;

export const useAuth = () => useContext(AuthContext);

const fetchRole = async (userId: string): Promise<Enums<"app_role"> | null> => {
  const { data: isAdmin, error: adminError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (!adminError && isAdmin) {
    return "admin";
  }

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    return null;
  }

  const roles = data?.map((entry) => entry.role) ?? [];

  if (roles.includes("admin")) {
    return "admin";
  }

  if (roles.includes("staff")) {
    return "staff";
  }

  return null;
};

const resolveRoleWithTimeout = (userId: string) =>
  Promise.race<Enums<"app_role"> | null>([
    fetchRole(userId),
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), ROLE_FETCH_TIMEOUT_MS);
    }),
  ]);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Enums<"app_role"> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let requestId = 0;
    let resolvedUserId: string | null = null;

    const resolveAuth = async (nextSession: Session | null, event?: string) => {
      if (!mounted) return;

      const nextUserId = nextSession?.user?.id ?? null;

      // Skip re-resolve if the user hasn't changed (e.g. TOKEN_REFRESHED on tab focus)
      if (resolvedUserId && nextUserId === resolvedUserId && event !== "SIGNED_OUT") {
        // Just update session/user refs without loading flash
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        return;
      }

      const currentRequest = ++requestId;
      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextUserId) {
        resolvedUserId = null;
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const nextRole = await resolveRoleWithTimeout(nextUserId);
        if (!mounted || currentRequest !== requestId) return;
        resolvedUserId = nextUserId;
        setRole(nextRole);
      } catch {
        if (!mounted || currentRequest !== requestId) return;
        setRole(null);
      } finally {
        if (mounted && currentRequest === requestId) {
          setLoading(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void resolveAuth(nextSession, event);
    });

    void supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      void resolveAuth(nextSession, "INITIAL");
    });

    return () => {
      mounted = false;
      requestId += 1;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
