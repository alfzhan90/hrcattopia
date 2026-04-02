import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { haversineDistance } from "@/lib/geo";
import type { Tables } from "@/integrations/supabase/types";

type Branch = Tables<"branches">;

export function useSmartNotifications(
  userId: string | undefined,
  branch: Branch | null | undefined,
  activeLogCheckInTime: string | null | undefined,
  hasActiveLog: boolean
) {
  const arrivalNotifiedRef = useRef(false);
  const shiftEndNotifiedRef = useRef(false);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Reset flags when active log changes
  useEffect(() => {
    if (!hasActiveLog) {
      arrivalNotifiedRef.current = false;
      shiftEndNotifiedRef.current = false;
    }
  }, [hasActiveLog]);

  // Arrival alert: check every 5 min if within geofence and not clocked in
  useEffect(() => {
    if (!branch || !userId || hasActiveLog) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const check = () => {
      if (arrivalNotifiedRef.current) return;
      navigator.geolocation.getCurrentPosition((pos) => {
        const dist = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          branch.latitude,
          branch.longitude
        );
        if (dist <= branch.radius_meters) {
          arrivalNotifiedRef.current = true;
          new Notification("📍 You have arrived!", {
            body: `You're near ${branch.name}. Don't forget to Clock In!`,
            icon: "/placeholder.svg",
          });
        }
      }, () => {});
    };

    check();
    const iv = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [branch, userId, hasActiveLog]);

  // Shift end alert: if worked 8h and not clocked out
  useEffect(() => {
    if (!hasActiveLog || !activeLogCheckInTime) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const check = () => {
      if (shiftEndNotifiedRef.current) return;
      const elapsed = (Date.now() - new Date(activeLogCheckInTime).getTime()) / (1000 * 60 * 60);
      if (elapsed >= 8) {
        shiftEndNotifiedRef.current = true;
        new Notification("⏰ Shift ending soon!", {
          body: "You've worked 8 hours. Remember to Clock Out!",
          icon: "/placeholder.svg",
        });
      }
    };

    check();
    const iv = setInterval(check, 60 * 1000);
    return () => clearInterval(iv);
  }, [hasActiveLog, activeLogCheckInTime]);
}
