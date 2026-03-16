"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type CompanyTab = {
  companyNumber: string;
  name: string;
};

type CompanyTabsContextValue = {
  tabs: CompanyTab[];
  upsertTab: (tab: CompanyTab) => void;
  closeTab: (companyNumber: string) => void;
  getTab: (companyNumber: string) => CompanyTab | undefined;
};

const CompanyTabsContext = createContext<CompanyTabsContextValue | null>(null);

const DEFAULT_TABS: CompanyTab[] = [
  { companyNumber: "09092149", name: "Starling Bank Limited" },
  { companyNumber: "09446231", name: "Monzo Bank Ltd" },
];

export function CompanyTabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<CompanyTab[]>(DEFAULT_TABS);

  const upsertTab = useCallback((tab: CompanyTab) => {
    setTabs((current) => {
      const normalizedNumber = tab.companyNumber.trim().toUpperCase();
      const normalizedName = tab.name.trim() || normalizedNumber;
      const existingIndex = current.findIndex((item) => item.companyNumber === normalizedNumber);

      if (existingIndex === -1) {
        return [...current, { companyNumber: normalizedNumber, name: normalizedName }];
      }

      const existing = current[existingIndex];
      if (existing.name === normalizedName) {
        return current;
      }

      return current.map((item, index) => (index === existingIndex ? { companyNumber: normalizedNumber, name: normalizedName } : item));
    });
  }, []);

  const closeTab = useCallback((companyNumber: string) => {
    setTabs((current) => current.filter((item) => item.companyNumber !== companyNumber.trim().toUpperCase()));
  }, []);

  const getTab = useCallback(
    (companyNumber: string) => tabs.find((item) => item.companyNumber === companyNumber.trim().toUpperCase()),
    [tabs],
  );

  const value = useMemo(
    () => ({
      tabs,
      upsertTab,
      closeTab,
      getTab,
    }),
    [tabs, upsertTab, closeTab, getTab],
  );

  return <CompanyTabsContext.Provider value={value}>{children}</CompanyTabsContext.Provider>;
}

export function useCompanyTabs() {
  const context = useContext(CompanyTabsContext);
  if (!context) {
    throw new Error("useCompanyTabs must be used within CompanyTabsProvider");
  }
  return context;
}
