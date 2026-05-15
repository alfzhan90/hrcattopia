import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExternalLink, X } from "lucide-react";

const DISMISSED_KEY = "hrc_iab_dismissed";

const isInAppBrowser = (): boolean => {
  const ua = navigator.userAgent;
  return (
    /FBAN|FBAV|Instagram|TikTok|BytedanceWebview|MicroMessenger|Line\/|Twitter|Snapchat|Pinterest/.test(ua) ||
    // Android WebView signature: contains "wv" token or lacks "Chrome" despite being Chromium
    (/Android/.test(ua) && /wv\)/.test(ua)) ||
    // Telegram in-app browser
    /Telegram/.test(ua)
  );
};

const getOpenInChromeUrl = (): string => {
  const search = window.location.search;
  return `intent://${window.location.host}${window.location.pathname}${search}#Intent;scheme=${window.location.protocol.replace(":", "")};package=com.android.chrome;end`;
};

const InAppBrowserBanner = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isInAppBrowser()) return;
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return;
    } catch {}
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch {}
    setShow(false);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] px-3 pt-3 pointer-events-none">
      <Alert className="pointer-events-auto border-amber-400/60 bg-amber-50 dark:bg-amber-950/60 shadow-lg rounded-xl">
        <AlertDescription className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">Open in Chrome for best experience</p>
            <p className="text-xs text-amber-800/70 dark:text-amber-300/70 mt-0.5">
              You're using an in-app browser. The app may not load or save your session properly.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-400 text-amber-900 dark:text-amber-200 hover:bg-amber-100"
              onClick={() => { window.location.href = getOpenInChromeUrl(); }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-700" onClick={dismiss}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default InAppBrowserBanner;
