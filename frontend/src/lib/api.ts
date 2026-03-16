export type CompanySearchResult = {
  company_number: string;
  name: string;
  status?: string | null;
  score?: number;
};

function getApiConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const token = process.env.NEXT_PUBLIC_API_TOKEN?.trim();
  const tenantId = process.env.NEXT_PUBLIC_TENANT_ID?.trim();

  if (!baseUrl || !token) {
    throw new Error("Frontend API env is missing. Set NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_API_TOKEN.");
  }

  return { baseUrl, token, tenantId };
}

export async function searchCompanies(query: string, limit = 6): Promise<CompanySearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const { baseUrl, token, tenantId } = getApiConfig();
  const url = new URL("/v1/companies/search", baseUrl);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", String(limit));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (tenantId) {
    headers["X-Tenant-Id"] = tenantId;
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { results?: CompanySearchResult[] };
  return payload.results ?? [];
}
