import { clearTokenCache, supabase } from "@/lib/supabase";

const SIGN_OUT_TIMEOUT_MS = 5000;

function clearStoredAuthArtifacts() {
  clearTokenCache();
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem("cbh-auth-token");
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("sb-"))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore storage access failures
  }
}

export async function logoutAndRefresh(redirectTo = "/") {
  try {
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((resolve) => setTimeout(resolve, SIGN_OUT_TIMEOUT_MS)),
    ]);
  } finally {
    clearStoredAuthArtifacts();
    if (typeof window !== "undefined") {
      const sep = redirectTo.includes("?") ? "&" : "?";
      window.location.replace(`${redirectTo}${sep}logout=${Date.now()}`);
    }
  }
}
