import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const IN_APP_PATTERNS = [
  /FBAN|FBAV|FB_IAB/i, // Facebook
  /Instagram/i,
  /WhatsApp/i,
  /Telegram/i,
  /Line\//i,
  /MicroMessenger/i, // WeChat
  /TikTok|musical_ly|Bytedance/i,
  /Twitter|TwitterAndroid/i,
  /LinkedInApp/i,
  /Snapchat/i,
];

const detectInAppBrowser = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return IN_APP_PATTERNS.some((pattern) => pattern.test(ua));
};

const STORAGE_KEY = "hrc_inapp_banner_dismissed";

const InAppBrowserBanner = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.sessionStorage.getItem(STORAGE_KEY);
    if (dismissed === "1") return;
    if (detectInAppBrowser()) setShow(true);
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="sticky top-0 z-50 w-full border-b border-yellow-300 bg-yellow-100 px-4 py-2 text-yellow-900 shadow-sm">
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-semibold">Open in your browser for the best experience</p>
          <p className="mt-1 text-xs">
            You're using an in-app browser which may cause loading issues. Tap the menu (⋮ or ⋯) and choose
            "Open in Chrome" or "Open in Browser".
          </p>
          {currentUrl && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(currentUrl).catch(() => {});
              }}
              className="mt-2 rounded bg-yellow-200 px-2 py-1 text-xs font-medium hover:bg-yellow-300"
            >
              Copy link
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="rounded p-1 hover:bg-yellow-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default InAppBrowserBanner;
