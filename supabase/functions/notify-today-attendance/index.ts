// One-shot: send Telegram notifications for all check-ins/outs today (MYT)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const escapeHtml = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!TELEGRAM_API_KEY || !TELEGRAM_CHAT_ID) throw new Error("Telegram secrets not configured");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase secrets not configured");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Today in MYT (UTC+8)
    const nowUtc = new Date();
    const mytOffset = 8 * 60 * 60 * 1000;
    const todayMyt = new Date(nowUtc.getTime() + mytOffset).toISOString().slice(0, 10);
    const startUtc = new Date(`${todayMyt}T00:00:00+08:00`).toISOString();
    const endUtc = new Date(`${todayMyt}T23:59:59+08:00`).toISOString();

    // Fetch today's logs
    const { data: logs, error: logsError } = await supabase
      .from("attendance_logs")
      .select("*")
      .gte("check_in_time", startUtc)
      .lte("check_in_time", endUtc)
      .order("check_in_time", { ascending: true });

    if (logsError) throw new Error(`DB error: ${logsError.message}`);
    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No attendance logs for today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all staff profiles and branches in one go
    const userIds = [...new Set(logs.map((l: any) => l.user_id).filter(Boolean))];
    const branchIds = [...new Set(logs.map((l: any) => l.branch_id).filter(Boolean))];

    const { data: staffRows } = await supabase
      .from("staff_profiles")
      .select("user_id, name, staff_id")
      .in("user_id", userIds);

    const { data: branchRows } = await supabase
      .from("branches")
      .select("id, name")
      .in("id", branchIds);

    const staffMap = new Map((staffRows ?? []).map((s: any) => [s.user_id, s]));
    const branchMap = new Map((branchRows ?? []).map((b: any) => [b.id, b.name]));

    const TELE_URL = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`;
    let sent = 0;
    let failed = 0;

    for (const log of logs as any[]) {
      const staff = staffMap.get(log.user_id);
      const staffName = staff?.name || staff?.staff_id || log.user_id;
      const staffId = staff?.staff_id || "";
      const branchName = branchMap.get(log.branch_id) || log.branch_id;

      // Send check-in notification
      const checkInTime = new Date(log.check_in_time).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });
      const lateMinutes = Number(log.late_minutes ?? 0);
      const lateInfo = lateMinutes > 0 ? `\n⚠️ Late: ${lateMinutes} min` : "";

      const checkInMsg =
        `✅ <b>Attendance Check-in</b>\n\n` +
        `👤 Name: <b>${escapeHtml(staffName)}</b>${staffId ? ` (${escapeHtml(staffId)})` : ""}\n` +
        `📍 Branch: ${escapeHtml(branchName)}\n` +
        `🕐 Time: ${escapeHtml(checkInTime)}` +
        lateInfo;

      const r1 = await fetch(TELE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: checkInMsg, parse_mode: "HTML" }),
      });
      r1.ok ? sent++ : failed++;

      // Small delay to avoid Telegram rate limit (30 msg/s)
      await new Promise((r) => setTimeout(r, 100));

      // Send check-out notification if exists
      if (log.check_out_time) {
        const checkOutTime = new Date(log.check_out_time).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });
        const checkOutMsg =
          `🚩 <b>Attendance Check-out</b>\n\n` +
          `👤 Name: <b>${escapeHtml(staffName)}</b>${staffId ? ` (${escapeHtml(staffId)})` : ""}\n` +
          `📍 Branch: ${escapeHtml(branchName)}\n` +
          `🕐 Time: ${escapeHtml(checkOutTime)}`;

        const r2 = await fetch(TELE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: checkOutMsg, parse_mode: "HTML" }),
        });
        r2.ok ? sent++ : failed++;

        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, logs: logs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-today-attendance error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
