import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const TOKEN_KEY = "downtime_auth_token";
const AUTH_TYPE_KEY = "downtime_auth_type";
const RESTAURANT_KEY = "downtime_restaurant";
const SUPERVISOR_KEY = "downtime_supervisor";

export type AuthType = "restaurant" | "supervisor" | null;

export type Restaurant = {
  id: number;
  name: string;
  location: string;
  pin: string;
  createdAt: string;
};

export type Supervisor = {
  id: number;
  username: string;
  name: string;
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
        setAuthType(savedType as AuthType);
        if (savedType === "restaurant" && savedRestaurant) {
          setRestaurant(JSON.parse(savedRestaurant));
        }
        if (savedType === "supervisor" && savedSupervisor) {
          setSupervisor(JSON.parse(savedSupervisor));
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const loginRestaurant = useCallback(
    async (newToken: string, rest: Restaurant) => {
      await AsyncStorage.multiSet([
        [TOKEN_KEY, newToken],
        [AUTH_TYPE_KEY, "restaurant"],
        [RESTAURANT_KEY, JSON.stringify(rest)],
      ]);
      setToken(newToken);
      setAuthType("restaurant");
      setRestaurant(rest);
      setSupervisor(null);
    },
    []
  );

  const loginSupervisor = useCallback(
    async (newToken: string, sup: Supervisor) => {
      await AsyncStorage.multiSet([
        [TOKEN_KEY, newToken],
        [AUTH_TYPE_KEY, "supervisor"],
        [SUPERVISOR_KEY, JSON.stringify(sup)],
      ]);
      setToken(newToken);
      setAuthType("supervisor");
      setSupervisor(sup);
      setRestaurant(null);
    },
    []
  );

  const logout = useCallback(async () => {
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
  }, []);

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
