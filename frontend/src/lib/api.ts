export type CompanySearchResult = {
  company_number: string;
  name: string;
  status?: string | null;
  score?: number;
};

export type CompanySearchItem = CompanySearchResult;

export interface CompanySearchResponse {
  results: CompanySearchResult[];
  next_cursor: string | null;
}

export type EntitySearchCompanyResult = {
  kind: "company";
  company_number: string;
  name: string;
  status?: string | null;
  score?: number;
};

export type EntitySearchPscResult = {
  kind: "psc";
  psc_key: string;
  company_number: string;
  company_name: string;
  company_status?: string | null;
  name: string;
  psc_kind: string;
  ceased?: boolean | null;
  dob_year?: number | null;
  dob_month?: number | null;
  score?: number;
};

export interface EntitySearchResponse {
  companies: EntitySearchCompanyResult[];
  psc: EntitySearchPscResult[];
}

export interface CompanyDetailResponse {
  company_number: string;
  name: string;
  status: string | null;
  incorporation_date: string | null;
  account_type: string | null;
  last_accounts_made_up_to: string | null;
  region: string | null;
  turnover: string | number | null;
  employees: number | null;
  net_assets: string | number | null;
  current_assets: string | number | null;
  creditors: string | number | null;
  cash: string | number | null;
  operating_profit?: string | number | null;
  profit_before_tax?: string | number | null;
  net_current_assets?: string | number | null;
  fixed_assets?: string | number | null;
  investments?: string | number | null;
  debtors?: string | number | null;
  trade_debtors?: string | number | null;
  trade_creditors?: string | number | null;
  other_debtors?: string | number | null;
  other_creditors?: string | number | null;
  deferred_tax?: string | number | null;
}

export interface CompanyOverviewResponse {
  company_number: string;
  name: string;
  status: string | null;
  account_type: string | null;
  last_accounts_made_up_to: string | null;
  turnover: string | number | null;
  employees: number | null;
  net_assets: string | number | null;
  current_assets: string | number | null;
  creditors: string | number | null;
  cash: string | number | null;
  operating_profit?: string | number | null;
  profit_before_tax?: string | number | null;
  net_current_assets?: string | number | null;
  fixed_assets?: string | number | null;
  investments?: string | number | null;
  debtors?: string | number | null;
  trade_debtors?: string | number | null;
  trade_creditors?: string | number | null;
  other_debtors?: string | number | null;
  other_creditors?: string | number | null;
  deferred_tax?: string | number | null;
  psc_count: number;
  current_ratio: number | null;
  updated_at: string;
}

export interface PscItem {
  psc_key: string;
  name: string;
  kind: string;
  natures_of_control: string[];
  nationality: string | null;
  country_of_residence: string | null;
  ceased: boolean | null;
  is_sanctioned?: boolean | null;
  notified_on: string | null;
  ceased_on: string | null;
  dob_year?: number | null;
  dob_month?: number | null;
  description?: string | null;
  address?: Record<string, unknown> | null;
  principal_office_address?: Record<string, unknown> | null;
  identification?: Record<string, unknown> | null;
  identity_verification?: Record<string, unknown> | null;
  link_self?: string | null;
  link_statement?: string | null;
  updated_at?: string | null;
}

export interface PscListResponse {
  company_number: string;
  items: PscItem[];
}

export interface PscRelationshipCompany {
  company_number: string;
  company_name: string;
  company_status: string | null;
  is_seed: boolean;
  psc: PscItem;
}

export interface PscRelationshipResponse {
  seed_company_number: string;
  seed_company_name: string;
  seed_company_status: string | null;
  seed: PscItem;
  linkable: boolean;
  match_basis: string | null;
  link_issue: string | null;
  linked_companies: PscRelationshipCompany[];
}

export interface FinancialSeriesPoint {
  period_date: string;
  value: string | number;
}

export interface FinancialSeriesResponse {
  company_number: string;
  metric: string;
  points: FinancialSeriesPoint[];
}

export interface CompanyFilingItem {
  document_id: number;
  company_number: string;
  source_path: string;
  doc_type: string;
  parsed_at: string;
  period_start: string | null;
  period_end: string | null;
  period_instant: string | null;
  current_period_date: string | null;
}

export interface CompanyFilingHistoryResponse {
  company_number: string;
  items: CompanyFilingItem[];
}

export interface CompanyFilingMetricValue {
  metric_key: string;
  value: string | number;
  period_date: string | null;
  source_count: number;
  priority: number;
}

export interface CompanyFilingSnapshotResponse {
  company_number: string;
  filing: CompanyFilingItem;
  metrics: CompanyFilingMetricValue[];
}

export interface CompanyFilingCompareMetric {
  metric_key: string;
  left_value: string | number | null;
  right_value: string | number | null;
  delta: string | number | null;
  delta_pct: number | null;
}

export interface CompanyFilingCompareResponse {
  company_number: string;
  left_filing: CompanyFilingItem;
  right_filing: CompanyFilingItem;
  metrics: CompanyFilingCompareMetric[];
}

export interface FinancialMetricDefinition {
  metric_key: string;
  tags: string[];
}

export interface FinancialMetricCatalogResponse {
  items: FinancialMetricDefinition[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { detail: raw };
    }
  }

  if (!response.ok) {
    const detail =
      payload &&
      typeof payload === "object" &&
      "detail" in payload &&
      typeof payload.detail === "string"
        ? payload.detail
        : `Request failed with ${response.status}`;
    throw new Error(detail);
  }

  return payload as T;
}

export async function searchCompanies(query: string, limit = 6): Promise<CompanySearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed,
    limit: String(limit),
  });
  const payload = await request<CompanySearchResponse>(`/v1/companies/search?${params.toString()}`);
  return payload.results ?? [];
}

export async function searchEntities(
  query: string,
  limit = 6,
  options?: { signal?: AbortSignal },
): Promise<EntitySearchResponse> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { companies: [], psc: [] };
  }

  const params = new URLSearchParams({
    q: trimmed,
    limit: String(limit),
  });
  return request<EntitySearchResponse>(`/v1/search?${params.toString()}`, { signal: options?.signal });
}

export function getCompany(companyNumber: string): Promise<CompanyDetailResponse> {
  return request<CompanyDetailResponse>(
    `/v1/companies/${encodeURIComponent(companyNumber)}`,
  );
}

export function getCompanyOverview(companyNumber: string): Promise<CompanyOverviewResponse> {
  return request<CompanyOverviewResponse>(
    `/v1/companies/${encodeURIComponent(companyNumber)}/overview`,
  );
}

export function getCompanyPsc(companyNumber: string, limit = 5): Promise<PscListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  return request<PscListResponse>(
    `/v1/companies/${encodeURIComponent(companyNumber)}/psc?${params.toString()}`,
  );
}

export function getCompanyFilings(companyNumber: string): Promise<CompanyFilingHistoryResponse> {
  return request<CompanyFilingHistoryResponse>(
    `/v1/companies/${encodeURIComponent(companyNumber)}/filings`,
  );
}

export function getCompanyFilingSnapshot(
  companyNumber: string,
  documentId: number,
): Promise<CompanyFilingSnapshotResponse> {
  return request<CompanyFilingSnapshotResponse>(
    `/v1/companies/${encodeURIComponent(companyNumber)}/filings/${documentId}/snapshot`,
  );
}

export function compareCompanyFilings(
  companyNumber: string,
  leftDocumentId: number,
  rightDocumentId: number,
): Promise<CompanyFilingCompareResponse> {
  const params = new URLSearchParams({
    left_document_id: String(leftDocumentId),
    right_document_id: String(rightDocumentId),
  });
  return request<CompanyFilingCompareResponse>(
    `/v1/companies/${encodeURIComponent(companyNumber)}/filings/compare?${params.toString()}`,
  );
}

export function getPscRelationships(
  companyNumber: string,
  pscKey: string,
): Promise<PscRelationshipResponse> {
  const params = new URLSearchParams({
    company: companyNumber,
    psc: pscKey,
  });
  return request<PscRelationshipResponse>(`/v1/psc/relationships?${params.toString()}`);
}

export function getFinancialSeries(
  companyNumber: string,
  metric: string,
): Promise<FinancialSeriesResponse> {
  const params = new URLSearchParams({ metric });
  return request<FinancialSeriesResponse>(
    `/v1/companies/${encodeURIComponent(companyNumber)}/financials/series?${params.toString()}`,
  );
}

export function getFinancialMetricCatalog(): Promise<FinancialMetricCatalogResponse> {
  return request<FinancialMetricCatalogResponse>("/v1/financials/metrics");
}
