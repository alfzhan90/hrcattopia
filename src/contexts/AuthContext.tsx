import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
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

const ROLE_FETCH_TIMEOUT_MS = 5000;
const ROLE_FETCH_RETRIES = 3;
const ROLE_CACHE_KEY = "hrc_role_cache";
const ROLE_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export const useAuth = () => useContext(AuthContext);

const getCachedRole = (userId: string): AppRole | null => {
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId: string; role: AppRole; ts: number };
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.ts > ROLE_CACHE_TTL_MS) return null;
    return parsed.role;
  } catch {
    return null;
  }
};

const setCachedRole = (userId: string, role: AppRole | null) => {
  try {
    if (!role) {
      localStorage.removeItem(ROLE_CACHE_KEY);
      return;
    }
    localStorage.setItem(
      ROLE_CACHE_KEY,
      JSON.stringify({ userId, role, ts: Date.now() }),
    );
  } catch {
    /* ignore */
  }
};

const fetchRoleOnce = async (userId: string): Promise<AppRole | null> => {
  const { data: isAdmin, error: adminError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (!adminError && isAdmin) return "admin";

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw error;

  const roles = data?.map((entry) => entry.role) ?? [];
  if (roles.includes("admin")) return "admin";
  if (roles.includes("area_manager")) return "area_manager";
  if (roles.includes("staff")) return "staff";
  return null;
};

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });

const fetchRoleWithRetry = async (userId: string): Promise<AppRole | null> => {
  let lastErr: unknown;
  for (let attempt = 0; attempt < ROLE_FETCH_RETRIES; attempt++) {
    try {
      return await withTimeout(fetchRoleOnce(userId), ROLE_FETCH_TIMEOUT_MS);
    } catch (e) {
      lastErr = e;
      // brief backoff before retry
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  console.warn("[auth] role fetch failed after retries", lastErr);
  return null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let requestId = 0;
    let resolvedUserId: string | null = null;

    const resolveAuth = async (nextSession: Session | null, event?: string) => {
      if (!mounted) return;

      const nextUserId = nextSession?.user?.id ?? null;

      if (resolvedUserId && nextUserId === resolvedUserId && event !== "SIGNED_OUT") {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        return;
      }

      const currentRequest = ++requestId;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextUserId) {
        resolvedUserId = null;
        setRole(null);
        setCachedRole("", null);
        setLoading(false);
        return;
      }

      // Show cached role immediately to avoid blank screen on slow networks
      const cached = getCachedRole(nextUserId);
      if (cached) {
        setRole(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const nextRole = await fetchRoleWithRetry(nextUserId);
        if (!mounted || currentRequest !== requestId) return;
        resolvedUserId = nextUserId;
        setRole(nextRole);
        setCachedRole(nextUserId, nextRole);
      } catch {
        if (!mounted || currentRequest !== requestId) return;
        if (!cached) setRole(null);
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
    setCachedRole("", null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
