/**
 * SaasAuth Context Stub for Marsbot Client (Offline Mode)
 * 本地客户端不需要 SaaS 认证，此文件提供兼容性存根
 */
import React, { createContext, useContext } from "react";

interface SaasUser {
  id: string;
  name?: string;
  email?: string;
  role?: string;
}

interface SaasAuthContextType {
  user: SaasUser | null;
  isAuthenticated: boolean;
  creditsLeft: number;
  logout: () => void;
}

const SaasAuthContext = createContext<SaasAuthContextType>({
  user: null,
  isAuthenticated: true, // 本地客户端始终视为已认证
  creditsLeft: 99999,
  logout: () => {},
});

export function SaasAuthProvider({ children }: { children: React.ReactNode }) {
  const value: SaasAuthContextType = {
    user: { id: "local-user", name: "本地用户", email: "local@marsbot.local" },
    isAuthenticated: true,
    creditsLeft: 99999,
    logout: () => {},
  };
  return <SaasAuthContext.Provider value={value}>{children}</SaasAuthContext.Provider>;
}

export function useSaasAuth() {
  return useContext(SaasAuthContext);
}
