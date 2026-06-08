export const INTERNAL_AUTH_EMAIL_DOMAIN = "yumk.local";

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/\s+/g, "");
}

export function usernameToAuthEmail(username: string) {
  return `${normalizeUsername(username)}@${INTERNAL_AUTH_EMAIL_DOMAIN}`;
}
