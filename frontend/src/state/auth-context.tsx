import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api, type User } from '../api/client';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  /** True when running embedded inside Banglai Cloud iframe (embed mode). */
  isEmbed: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Embed mode: when BornoOCR is loaded inside the Banglai Cloud iframe, the URL
 * contains `?embed=1&embed_token=<signed JWT>`. In this mode we skip the OTP
 * auth flow entirely and trust the signed token from Banglai Cloud.
 *
 * The token payload (base64url-encoded JSON) contains: { uid, email, name, plan, exp }.
 * The frontend only decodes the payload to construct a User — signature verification
 * happens server-side on each API call via the Authorization header.
 */
function getEmbedTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('embed') !== '1') return null;
  return params.get('embed_token');
}

function decodeEmbedPayload(token: string): { uid: string; email: string; name: string; plan: string; exp: number } | null {
  try {
    const payloadB64 = token.split('.')[0];
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    // Reject expired tokens on the frontend so the user sees a login prompt
    // instead of a broken editor. The backend also checks expiry, but this
    // avoids a flash of authenticated-then-401 UX.
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmbed, setIsEmbed] = useState(false);

  useEffect(() => {
    // Embed mode: Banglai Cloud passes a signed token via URL query param.
    const embedToken = getEmbedTokenFromUrl();
    if (embedToken) {
      const payload = decodeEmbedPayload(embedToken);
      if (payload) {
        api.setToken(embedToken);
        setUser({
          id: payload.uid,
          email: payload.email,
          name: payload.name,
          plan: payload.plan,
        });
        setIsEmbed(true);
        setLoading(false);
        return;
      }
    }

    // Standalone mode: use BornoOCR's own JWT from localStorage.
    const token = api.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api.auth
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        api.setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function login(token: string, u: User) {
    api.setToken(token);
    setUser(u);
  }

  function logout() {
    // In embed mode, logout is a no-op (Banglai Cloud controls the session).
    if (isEmbed) return;
    api.setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isEmbed }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
