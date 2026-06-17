import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, supervisorLogout, getMe } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  configurePushNotifications,
  registerSupervisorPushToken,
} from "../hooks/usePushNotifications";

const TOKEN_KEY = "downtime_auth_token";
const AUTH_TYPE_KEY = "downtime_auth_type";
const RESTAURANT_KEY = "downtime_restaurant";
const SUPERVISOR_KEY = "downtime_supervisor";

export type AuthType = "restaurant" | "supervisor" | null;

export type Restaurant = {
  id: number;
  name: string;
  location: string;
  createdAt: string;
};

export type Supervisor = {
  id: number;
  email: string;
  name: string;
  // "super_admin" is the platform-level role with no organization. The mobile
  // UI currently lands super_admins on the same screens as supervisors until
  // Phase 3 ships the dedicated super-admin route group.
  role: "admin" | "supervisor" | "super_admin";
  // Which issue category this user handles. Drives the default category on the
  // issues list. Admins always see/get everything regardless.
  specialty: "equipment" | "technology" | "both";
  // Null only for super_admin (cross-org). Every other role has a single org.
  organizationId: number | null;
};

type AuthContextType = {
  isLoading: boolean;
  authType: AuthType;
  token: string | null;
  restaurant: Restaurant | null;
  supervisor: Supervisor | null;
  loginRestaurant: (token: string, restaurant: Restaurant) => Promise<void>;
  loginSupervisor: (token: string, supervisor: Supervisor) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [authType, setAuthType] = useState<AuthType>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);

  useEffect(() => {
    configurePushNotifications();
    loadSession();
  }, []);

  useEffect(() => {
    const currentToken = token;
    setAuthTokenGetter(() => currentToken);
  }, [token]);

  const loadSession = async () => {
    try {
      const [savedToken, savedType, savedRestaurant, savedSupervisor] =
        await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(AUTH_TYPE_KEY),
          AsyncStorage.getItem(RESTAURANT_KEY),
          AsyncStorage.getItem(SUPERVISOR_KEY),
        ]);

      if (savedToken && savedType) {
        setToken(savedToken);
        setAuthTokenGetter(() => savedToken);
        // Capture the /auth/me response so we can refresh the persisted
        // user data with the server's current shape. Without this, a
        // pre-Phase-3 stored Supervisor JSON (missing organizationId) would
        // silently lie to the typecast and downstream code would see
        // undefined where the type promises number | null. Same logic for
        // restaurant in case the Restaurant shape ever changes.
        let meResponse: Awaited<ReturnType<typeof getMe>>;
        try {
          meResponse = await getMe();
        } catch {
          await AsyncStorage.multiRemove([TOKEN_KEY, AUTH_TYPE_KEY, RESTAURANT_KEY, SUPERVISOR_KEY]);
          setToken(null);
          return;
        }
        setAuthType(savedType as AuthType);
        if (savedType === "restaurant") {
          if (meResponse.type === "restaurant" && meResponse.restaurant) {
            const fresh = meResponse.restaurant as Restaurant;
            await AsyncStorage.setItem(RESTAURANT_KEY, JSON.stringify(fresh));
            setRestaurant(fresh);
          } else if (savedRestaurant) {
            setRestaurant(JSON.parse(savedRestaurant));
          }
        }
        if (savedType === "supervisor") {
          if (meResponse.type === "supervisor" && meResponse.supervisor) {
            // Same role-narrowing safety net as login.tsx — if the server
            // ever returns a role string the client doesn't know, fall back
            // to lowest-privilege "supervisor".
            const rawRole = meResponse.supervisor.role;
            const role: "admin" | "supervisor" | "super_admin" =
              rawRole === "admin" || rawRole === "super_admin" ? rawRole : "supervisor";
            const rawSpecialty = meResponse.supervisor.specialty;
            const specialty: Supervisor["specialty"] =
              rawSpecialty === "equipment" || rawSpecialty === "technology"
                ? rawSpecialty
                : "both";
            const fresh: Supervisor = {
              id: meResponse.supervisor.id,
              email: meResponse.supervisor.email,
              name: meResponse.supervisor.name,
              role,
              specialty,
              organizationId: meResponse.supervisor.organizationId,
            };
            await AsyncStorage.setItem(SUPERVISOR_KEY, JSON.stringify(fresh));
            setSupervisor(fresh);
          } else if (savedSupervisor) {
            setSupervisor(JSON.parse(savedSupervisor) as Supervisor);
          }
          registerSupervisorPushToken(savedToken).catch(() => {});
        }
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const loginRestaurant = useCallback(
    async (newToken: string, rest: Restaurant) => {
      queryClient.clear();
      const { id, name, location, createdAt } = rest;
      const safeRest: Restaurant = { id, name, location, createdAt };
      await AsyncStorage.multiSet([
        [TOKEN_KEY, newToken],
        [AUTH_TYPE_KEY, "restaurant"],
        [RESTAURANT_KEY, JSON.stringify(safeRest)],
      ]);
      setToken(newToken);
      setAuthType("restaurant");
      setRestaurant(safeRest);
      setSupervisor(null);
    },
    []
  );

  const loginSupervisor = useCallback(
    async (newToken: string, sup: Supervisor) => {
      queryClient.clear();
      await AsyncStorage.multiSet([
        [TOKEN_KEY, newToken],
        [AUTH_TYPE_KEY, "supervisor"],
        [SUPERVISOR_KEY, JSON.stringify(sup)],
      ]);
      setToken(newToken);
      setAuthType("supervisor");
      setSupervisor(sup);
      setRestaurant(null);
      registerSupervisorPushToken(newToken).catch(() => {});
    },
    []
  );

  const logout = useCallback(async () => {
    if (authType === "supervisor") {
      try {
        await supervisorLogout();
      } catch {
      }
    }
    queryClient.clear();
    await AsyncStorage.multiRemove([
      TOKEN_KEY,
      AUTH_TYPE_KEY,
      RESTAURANT_KEY,
      SUPERVISOR_KEY,
    ]);
    setToken(null);
    setAuthType(null);
    setRestaurant(null);
    setSupervisor(null);
  }, [authType]);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        authType,
        token,
        restaurant,
        supervisor,
        loginRestaurant,
        loginSupervisor,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
