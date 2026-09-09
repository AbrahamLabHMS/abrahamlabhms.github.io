export function alumniSourceError(entry) {
  // Retained historical destinations can appear as plain text without a link.
  if (!entry.destinationSource) return null;
  if (!entry.destination?.trim()) return "has a source but no destination text";
  try {
    const url = new URL(entry.destinationSource);
    if (url.protocol !== "https:" || url.username || url.password) {
      return "needs a public HTTPS institutional or professional source";
    }
    const host = url.hostname.replace(/^www\./, "").replace(/\.$/, "");
    const isLabSite = ["abrahamlab.med.harvard.edu", "abrahamlabhms.github.io"].includes(host) ||
      (host === "jamesspencer-source.github.io" && /^\/abraham-lab-website(?:-demo)?(?:\/|$)/i.test(url.pathname));
    if (isLabSite) return "must link to an outside institutional or professional source, not an Abraham Lab website";
    return null;
  } catch {
    return "has an invalid source URL";
  }
}
