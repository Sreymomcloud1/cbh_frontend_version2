export const BUSINESS_DATA_CHANGED = "cbh:business-data-changed";
export const PROFILE_UPDATED = "cbh:profile-updated";

type BusinessChangeDetail = {
  id?: string;
  action?: "created" | "updated" | "deleted" | "verified" | "revoked";
};

type ProfileUpdateDetail = {
  name?: string;
  avatarUrl?: string;
};

export function notifyBusinessDataChanged(detail: BusinessChangeDetail = {}) {
  if (typeof window === "undefined") return;

  const payload = { ...detail, at: Date.now() };
  window.dispatchEvent(new CustomEvent(BUSINESS_DATA_CHANGED, { detail: payload }));
  window.localStorage.setItem(BUSINESS_DATA_CHANGED, JSON.stringify(payload));
}

export function onBusinessDataChanged(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const onLocalChange = () => callback();
  const onStorage = (event: StorageEvent) => {
    if (event.key === BUSINESS_DATA_CHANGED) callback();
  };

  window.addEventListener(BUSINESS_DATA_CHANGED, onLocalChange);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(BUSINESS_DATA_CHANGED, onLocalChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function freshSupplierHref(id: string) {
  return `/supplier/${id}?fresh=${Date.now()}`;
}

export function notifyProfileUpdated(detail: ProfileUpdateDetail = {}) {
  if (typeof window === "undefined") return;

  const payload = { ...detail, at: Date.now() };
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED, { detail: payload }));
  window.localStorage.setItem(PROFILE_UPDATED, JSON.stringify(payload));
}

export function onProfileUpdated(callback: (detail?: ProfileUpdateDetail) => void) {
  if (typeof window === "undefined") return () => {};

  const onLocalChange = (event: Event) => {
    callback((event as CustomEvent<ProfileUpdateDetail>).detail);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PROFILE_UPDATED || !event.newValue) return;
    try {
      callback(JSON.parse(event.newValue) as ProfileUpdateDetail);
    } catch {
      callback();
    }
  };

  window.addEventListener(PROFILE_UPDATED, onLocalChange);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(PROFILE_UPDATED, onLocalChange);
    window.removeEventListener("storage", onStorage);
  };
}
