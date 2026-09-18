import type { LinkedInProfile } from "../data/types";

export function linkedInProfileError(profile: unknown): string | null {
  if (profile === undefined) return null;
  if (!profile || typeof profile !== "object" || !("url" in profile) || !("optedIn" in profile)) {
    return "LinkedIn requires a profile URL and explicit optedIn status";
  }
  if (typeof profile.optedIn !== "boolean") return "LinkedIn optedIn must be true or false";
  if (typeof profile.url !== "string" || profile.url !== profile.url.trim()) {
    return "LinkedIn requires a clean HTTPS profile URL";
  }
  try {
    const url = new URL(profile.url);
    if (url.protocol !== "https:" || !["linkedin.com", "www.linkedin.com"].includes(url.hostname) ||
        url.username || url.password || url.port || url.search || url.hash ||
        !/^\/in\/[a-z\d_%~-]+\/?$/i.test(url.pathname)) {
      return "LinkedIn must use https://www.linkedin.com/in/profile with no tracking parameters";
    }
    decodeURIComponent(url.pathname);
    return null;
  } catch {
    return "LinkedIn requires a valid HTTPS profile URL";
  }
}

export function publicLinkedInUrl(profile?: LinkedInProfile): string | undefined {
  if (linkedInProfileError(profile) || profile?.optedIn !== true) return undefined;
  return profile.url;
}

export function publicEmailError(email: unknown): string | null {
  if (email === undefined) return null;
  if (typeof email !== "string" || email.length > 254 ||
      !/^[a-z0-9_+-]+(?:\.[a-z0-9_+-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(email) ||
      email.split("@")[0].length > 64) {
    return "Public email must be one plain email address, without a mailto prefix or message parameters";
  }
  return null;
}

export function publicEmailHref(email?: string): string | undefined {
  if (email === undefined || publicEmailError(email)) return undefined;
  return `mailto:${email}`;
}
