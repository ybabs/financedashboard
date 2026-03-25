export function formatOfficerName(name: string | null | undefined): string {
  const normalized = (name ?? "").trim();
  if (!normalized) {
    return "Name unavailable";
  }
  if (normalized !== normalized.toUpperCase()) {
    return normalized;
  }

  return normalized
    .toLowerCase()
    .split(/\s+/)
    .map((part) =>
      part
        .split("-")
        .map((segment) => (segment ? `${segment[0].toUpperCase()}${segment.slice(1)}` : segment))
        .join("-"),
    )
    .join(" ");
}

export function formatOfficerRole(role: string | null | undefined): string {
  const normalized = (role ?? "").trim();
  return normalized || "Officer";
}
