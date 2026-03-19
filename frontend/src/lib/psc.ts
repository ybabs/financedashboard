import type { PscItem } from "@/lib/api";

export function formatPscKind(kind: string): string {
  return kind
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatNatureOfControl(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPartialDateOfBirth(year?: number | null, month?: number | null): string {
  if (!year) {
    return "Unavailable";
  }
  if (!month || month < 1 || month > 12) {
    return String(year);
  }
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    timeZone: "UTC",
  });
  return `${monthLabel} ${year}`;
}

export function buildCompaniesHousePscUrl(linkSelf?: string | null): string | null {
  if (!linkSelf) {
    return null;
  }

  // TODO: Re-introduce a user-facing Companies House action when we have a
  // reliable public-record URL for PSCs. The API-style PSC self link currently
  // stored in `link_self` resolves to a 404 on Find and Update.
  if (linkSelf.startsWith("/company/") && linkSelf.includes("/persons-with-significant-control/")) {
    return null;
  }

  if (/^https?:\/\//.test(linkSelf)) {
    return linkSelf;
  }

  if (linkSelf.startsWith("/")) {
    return `https://find-and-update.company-information.service.gov.uk${linkSelf}`;
  }

  return null;
}

export function isPscCeased(item: Pick<PscItem, "ceased" | "ceased_on">): boolean {
  return Boolean(item.ceased) || Boolean(item.ceased_on);
}

export function getPscStatusLabel(item: Pick<PscItem, "ceased" | "ceased_on">): string {
  return isPscCeased(item) ? "Ceased" : "Active";
}
