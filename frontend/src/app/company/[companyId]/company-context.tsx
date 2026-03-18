"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  CompanyDetailResponse,
  CompanyOverviewResponse,
  PscItem,
  getCompany,
  getCompanyOverview,
  getCompanyPsc,
} from "@/lib/api";

type CompanyContextValue = {
  companyId: string;
  detail: CompanyDetailResponse | null;
  overview: CompanyOverviewResponse | null;
  psc: PscItem[];
  isLoading: boolean;
  error: string | null;
};

const EMPTY_PSC: PscItem[] = [];

type CompanyLoadState = {
  companyId: string;
  detail: CompanyDetailResponse | null;
  overview: CompanyOverviewResponse | null;
  psc: PscItem[];
  error: string | null;
  loaded: boolean;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyDataProvider({
  companyId,
  children,
}: {
  companyId: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<CompanyLoadState>(() => ({
    companyId,
    detail: null,
    overview: null,
    psc: [],
    error: null,
    loaded: false,
  }));

  useEffect(() => {
    let isActive = true;

    Promise.all([
      getCompany(companyId),
      getCompanyOverview(companyId),
      getCompanyPsc(companyId, 5),
    ])
      .then(([detailPayload, overviewPayload, pscPayload]) => {
        if (!isActive) {
          return;
        }
        setState({
          companyId,
          detail: detailPayload,
          overview: overviewPayload,
          psc: pscPayload.items,
          error: null,
          loaded: true,
        });
      })
      .catch((fetchError) => {
        if (!isActive) {
          return;
        }
        setState({
          companyId,
          detail: null,
          overview: null,
          psc: [],
          error: fetchError instanceof Error ? fetchError.message : "Failed to load company profile",
          loaded: true,
        });
      });

    return () => {
      isActive = false;
    };
  }, [companyId]);

  const isCurrentCompany = state.companyId === companyId;
  const detail = isCurrentCompany ? state.detail : null;
  const overview = isCurrentCompany ? state.overview : null;
  const psc = isCurrentCompany ? state.psc : EMPTY_PSC;
  const error = isCurrentCompany ? state.error : null;
  const isLoading = !isCurrentCompany || !state.loaded;

  const value = useMemo<CompanyContextValue>(
    () => ({
      companyId,
      detail,
      overview,
      psc,
      isLoading,
      error,
    }),
    [companyId, detail, overview, psc, isLoading, error],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompanyData(): CompanyContextValue {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error("useCompanyData must be used within CompanyDataProvider");
  }
  return context;
}
