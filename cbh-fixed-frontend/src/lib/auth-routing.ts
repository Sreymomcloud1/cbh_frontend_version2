export interface AuthProfileSnapshot {
  role?: string | null;
  pending_business?: boolean | null;
}

export type IntendedRole = "buyer" | "business" | null | undefined;

export function resolveDashboardPath(
  profile: AuthProfileSnapshot | null | undefined,
  intendedRole?: IntendedRole
) {
  const role = profile?.role ?? "buyer";
  const isPendingBusiness = profile?.pending_business ?? false;

  if (role === "admin") return "/admin";
  if (role === "business" || isPendingBusiness || intendedRole === "business") {
    return "/business-dashboard";
  }
  return "/dashboard";
}

export function resolveSafeRedirect(redirectParam?: string | null) {
  if (!redirectParam) return null;
  if (!redirectParam.startsWith("/") || redirectParam.startsWith("//")) return null;
  return redirectParam;
}
