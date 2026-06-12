/** True when the user is on a phone (not desktop or tablet). */
export function isPhoneDevice(): boolean {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent;
  const isIPhone = /iPhone|iPod/i.test(ua);
  const isAndroidPhone = /Android/i.test(ua) && !/Tablet|iPad/i.test(ua);
  const isCoarseNarrow = window.matchMedia(
    "(max-width: 520px) and (pointer: coarse)",
  ).matches;

  return isIPhone || isAndroidPhone || isCoarseNarrow;
}
