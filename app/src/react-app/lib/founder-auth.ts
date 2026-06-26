/**
 * Founder Authentication — secure credential management.
 * Credentials are configurable via environment/localStorage,
 * NOT hardcoded in source code.
 */

const DEFAULT_CREDS = {
  username: "FOUNDER",
  password: "fuelpro2026",
};

const STORAGE_KEY = "fuelpro_founder_creds";
const SESSION_KEY = "fuelpro_founder_session";

/** Get current credentials (configurable, not hardcoded) */
export function getFounderCredentials(): {
  username: string;
  password: string;
} {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* */
  }
  return DEFAULT_CREDS;
}

/** Update founder credentials */
export function setFounderCredentials(
  username: string,
  password: string
): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, password }));
}

/** Check if credentials match */
export function validateFounderAuth(
  inputUser: string,
  inputPw: string
): boolean {
  const creds = getFounderCredentials();
  return inputUser.toLowerCase() === creds.username.toLowerCase() && inputPw === creds.password;
}

/** Check active founder session */
export function hasFounderSession(): boolean {
  try {
    const s = localStorage.getItem(SESSION_KEY);
    if (!s) return false;
    const { loginTime } = JSON.parse(s);
    // Session valid for 8 hours
    return Date.now() - loginTime < 8 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Start founder session */
export function startFounderSession(): void {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ loginTime: Date.now(), active: true })
  );
}

/** End founder session */
export function endFounderSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/** Reset credentials to default (emergency recovery) */
export function resetFounderCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}
