/**
 * Calculate distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const DEVICE_TOKEN_KEY = "cattopia_device_token";

/**
 * Get or create a persistent device token stored in localStorage.
 * This is the PRIMARY identifier — stable across sessions regardless of
 * browser updates, IP changes, or WebKit quirks on iOS Chrome.
 */
function getOrCreateDeviceToken(): string {
  try {
    let token = localStorage.getItem(DEVICE_TOKEN_KEY);
    if (token) return token;
    // Generate a UUID v4
    token = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
    return token;
  } catch {
    // Private browsing or storage disabled — fall back to session-only
    return `ephemeral-${Date.now()}`;
  }
}

/**
 * Build a lightweight hardware signature from stable browser properties.
 * Deliberately excludes userAgent (changes on every browser update and
 * is spoofed differently by Chrome-on-iOS / WebKit).
 */
function hardwareSignature(): string {
  const parts = [
    `${screen.width}x${screen.height}`,
    screen.colorDepth?.toString() ?? "",
    navigator.hardwareConcurrency?.toString() ?? "",
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    // devicePixelRatio is stable per physical device
    (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1).toString(),
    // maxTouchPoints distinguishes mobile vs desktop reliably
    navigator.maxTouchPoints?.toString() ?? "0",
  ];
  const str = parts.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36).toUpperCase();
}

/**
 * Generate a stable device fingerprint.
 *
 * Format: `DEV-<persistentToken>-<hwSig>`
 *
 * Matching logic (see also StaffProfile & Attendance):
 *   1. If the persistent token matches → device is verified (primary check).
 *   2. The hardware signature is informational / secondary.
 *
 * This approach survives:
 *   - IP address changes (not used at all)
 *   - Browser / OS minor updates (userAgent excluded)
 *   - Chrome-on-iOS WebKit differences (no UA dependency)
 */
export function generateDeviceFingerprint(): string {
  const token = getOrCreateDeviceToken();
  const hw = hardwareSignature();
  return `DEV-${token}-${hw}`;
}

/**
 * Extract just the persistent token portion from a full fingerprint string.
 * Returns the UUID between the first and last hyphen-segment.
 */
export function extractDeviceToken(fingerprint: string): string {
  // Format: DEV-<uuid>-<hwSig>
  const parts = fingerprint.split("-");
  if (parts.length < 3) return fingerprint;
  // Token is everything between first "DEV" and last segment (hw sig)
  return parts.slice(1, -1).join("-");
}

/**
 * Check if two fingerprints represent the same device.
 * Primary: persistent token match. Fallback: full string match.
 */
export function isSameDevice(stored: string | null, current: string): boolean {
  if (!stored) return false;
  if (stored === current) return true;
  // Compare just the persistent token portions
  return extractDeviceToken(stored) === extractDeviceToken(current);
}

/**
 * Get current position as a promise.
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}
