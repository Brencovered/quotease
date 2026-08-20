/**
 * Survives AppHeader remounts on client navigations (each page renders its
 * own <AppHeader />, which was re-fetching role and flashing full nav).
 */

const SESSION_KEY = "ss_is_field_worker";

let memoryIsFieldWorker: boolean | null = null;

export function getCachedIsFieldWorker(): boolean | null {
  if (memoryIsFieldWorker !== null) return memoryIsFieldWorker;
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(SESSION_KEY);
    if (v === "1") {
      memoryIsFieldWorker = true;
      return true;
    }
    if (v === "0") {
      memoryIsFieldWorker = false;
      return false;
    }
  } catch {
    // private mode / blocked storage
  }
  return null;
}

export function setCachedIsFieldWorker(isFieldWorker: boolean) {
  memoryIsFieldWorker = isFieldWorker;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, isFieldWorker ? "1" : "0");
  } catch {
    // ignore
  }
}

export function clearCachedIsFieldWorker() {
  memoryIsFieldWorker = null;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
