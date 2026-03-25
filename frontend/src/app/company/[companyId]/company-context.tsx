"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import {
  CompanyDetailResponse,
  CompanyFilingItem,
  CompanyOfficerItem,
  CompanyOverviewResponse,
  PscItem,
  getCompany,
  getCompanyOfficers,
  getCompanyOverview,
  getCompanyPsc,
} from "@/lib/api";

type CompanyContextValue = {
  companyId: string;
  detail: CompanyDetailResponse | null;
  overview: CompanyOverviewResponse | null;
  psc: PscItem[];
  officers: CompanyOfficerItem[];
  officersSourceFiling: CompanyFilingItem | null;
  isLoading: boolean;
  error: string | null;
};

const EMPTY_PSC: PscItem[] = [];
const EMPTY_OFFICERS: CompanyOfficerItem[] = [];

type CompanyLoadState = {
  companyId: string;
  detail: CompanyDetailResponse | null;
  overview: CompanyOverviewResponse | null;
  psc: PscItem[];
  officers: CompanyOfficerItem[];
  officersSourceFiling: CompanyFilingItem | null;
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
    officers: [],
    officersSourceFiling: null,
    error: null,
    loaded: false,
  }));

  useEffect(() => {
    let isActive = true;

    Promise.all([
      getCompany(companyId),
      getCompanyOverview(companyId),
      getCompanyPsc(companyId, 5).catch(() => ({ company_number: companyId, items: [] })),
      getCompanyOfficers(companyId, 12).catch(() => ({ company_number: companyId, source_filing: null, items: [] })),
    ])
      .then(([detailPayload, overviewPayload, pscPayload, officersPayload]) => {
        if (!isActive) {
          return;
        }
        setState({
          companyId,
          detail: detailPayload,
          overview: overviewPayload,
          psc: pscPayload.items,
          officers: officersPayload.items,
          officersSourceFiling: officersPayload.source_filing,
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
          officers: [],
          officersSourceFiling: null,
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
  const officers = isCurrentCompany ? state.officers : EMPTY_OFFICERS;
  const officersSourceFiling = isCurrentCompany ? state.officersSourceFiling : null;
  const error = isCurrentCompany ? state.error : null;
  const isLoading = !isCurrentCompany || !state.loaded;

  const value = useMemo<CompanyContextValue>(
    () => ({
      companyId,
      detail,
      overview,
      psc,
      officers,
      officersSourceFiling,
      isLoading,
      error,
    }),
    [companyId, detail, overview, psc, officers, officersSourceFiling, isLoading, error],
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
