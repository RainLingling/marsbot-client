import React, { useState, useEffect } from "react";
import HomePage from "./pages/HomePage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import { Toaster } from "@/components/ui/sonner";

// ─── 简单路由 ──────────────────────────────────────────────────────────────────
type Page = "home" | "history" | "settings";

export interface AppContext {
  currentPage: Page;
  navigate: (page: Page) => void;
}

export const AppCtx = React.createContext<AppContext>({
  currentPage: "home",
  navigate: () => {},
});

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");

  const navigate = (page: Page) => setCurrentPage(page);

  return (
    <AppCtx.Provider value={{ currentPage, navigate }}>
      <div className="min-h-screen bg-background text-foreground">
        {currentPage === "home" && <HomePage />}
        {currentPage === "history" && <HistoryPage />}
        {currentPage === "settings" && <SettingsPage />}
        <Toaster />
      </div>
    </AppCtx.Provider>
  );
}
