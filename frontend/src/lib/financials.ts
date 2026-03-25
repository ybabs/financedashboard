export type MetricFormatter = "currency" | "ratio" | "integer" | "date";
export type DisclosureFocusArea =
  | "director_remuneration"
  | "dividends"
  | "loans"
  | "related_parties";

export function formatMetricLabel(metricKey: string): string {
  return metricKey
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatNormalizedTagLabel(tag: string): string {
  return tag
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeFinancialTag(tag: string): string {
  return tag
    .replace(/^.*:/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function getDisclosureFocusArea(input: {
  raw_tag: string;
  normalized_tag?: string | null;
  label?: string | null;
}): DisclosureFocusArea | null {
  const normalizedTag = (input.normalized_tag || normalizeFinancialTag(input.raw_tag || "")).toLowerCase();
  const label = (input.label || "").toLowerCase();
  const haystack = `${normalizedTag} ${label}`;

  if (haystack.includes("remunerat") || haystack.includes("directorfee") || haystack.includes("keymanagementcompensation")) {
    return "director_remuneration";
  }
  if (haystack.includes("dividend")) {
    return "dividends";
  }
  if (haystack.includes("loan") || haystack.includes("advance") || haystack.includes("directoraccount")) {
    return "loans";
  }
  if (haystack.includes("relatedpart") || haystack.includes("controllingpart")) {
    return "related_parties";
  }
  return null;
}

export function getDisclosureFocusLabel(area: DisclosureFocusArea): string {
  switch (area) {
    case "director_remuneration":
      return "Director Remuneration";
    case "dividends":
      return "Dividends";
    case "loans":
      return "Loans and Advances";
    case "related_parties":
      return "Related Parties";
  }
}

export function getDisclosureFocusDescription(area: DisclosureFocusArea): string {
  switch (area) {
    case "director_remuneration":
      return "Board pay, compensation, and management remuneration disclosures.";
    case "dividends":
      return "Dividend policy, declared amounts, and payments to shareholders.";
    case "loans":
      return "Loans, advances, and director or related-party balances and terms.";
    case "related_parties":
      return "Related-party relationships, balances, transactions, and controlling-party notes.";
  }
}
