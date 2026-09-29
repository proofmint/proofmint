/**
 * Badge `customProperties` is persisted in two shapes: the issuer UI and
 * app/api/badges/create write an array of `{ key, value }` pairs, while
 * app/api/x402/badges/mint stores the caller's ARC-3 `properties` object
 * verbatim. Readers normalize both into key/value pairs.
 */
export type BadgeProperty = { key: string; value: string };

function toDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function normalizeCustomProperties(raw: unknown): BadgeProperty[] {
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (prop): prop is Record<string, unknown> =>
          typeof prop === "object" && prop !== null,
      )
      .map((prop) => ({
        key: toDisplayValue(prop.key),
        value: toDisplayValue(prop.value),
      }))
      .filter((prop) => prop.key !== "");
  }

  if (typeof raw === "object" && raw !== null) {
    return Object.entries(raw as Record<string, unknown>).map(
      ([key, value]) => ({ key, value: toDisplayValue(value) }),
    );
  }

  return [];
}
