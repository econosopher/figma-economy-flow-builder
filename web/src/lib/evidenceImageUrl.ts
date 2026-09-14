const wardogsEvidenceHost = "flow.gameeconomistconsulting.com";
const wardogsEvidencePrefix = "/evidence/wardogs/";

/**
 * Use bundled Wardogs evidence while developing or staging, but retain the
 * canonical URL as the evidence source and leave every external image alone.
 */
export function resolveEvidenceImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:" &&
      parsed.hostname === wardogsEvidenceHost &&
      parsed.pathname.startsWith(wardogsEvidencePrefix)
    )
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    // Document validation owns URL rejection. Rendering should fail closed.
  }
  return url;
}
