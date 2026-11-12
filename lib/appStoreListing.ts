/**
 * Whether Apple's public lookup lists this exact app. TestFlight-only apps
 * return no results, so an empty or mismatched response means "not public".
 */
export function isAppStoreListingPublic(lookup: unknown, appStoreId: string): boolean {
  if (typeof lookup !== "object" || lookup === null) return false;
  const results = (lookup as { results?: unknown }).results;
  if (!Array.isArray(results)) return false;
  return results.some(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      String((entry as { trackId?: unknown }).trackId) === appStoreId,
  );
}
