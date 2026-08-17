export const NAVIGATION_BADGES_EVENT = "manta360:navigation-badges-refresh";

export function notifyNavigationBadgesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAVIGATION_BADGES_EVENT));
}
