import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/.*\.lovable\.app$/,
  /^https:\/\/.*\.lovableproject\.com$/,
];

const getCorsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin)) ? origin : "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};
    console.log("Function received data:", body);

    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY is not configured");

    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TELEGRAM_CHAT_ID) throw new Error("TELEGRAM_CHAT_ID is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const incomingRecord = body?.record && typeof body.record === "object" ? body.record : body;
    if (!incomingRecord || typeof incomingRecord !== "object") {
      return new Response(JSON.stringify({ error: "No record provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let record = incomingRecord as Record<string, unknown>;

    if (record.id && (!record.user_id || !record.branch_id || (!record.check_in_time && !record.check_out_time))) {
      const { data: attendanceRow, error: attendanceError } = await supabase
        .from("attendance_logs")
        .select("*")
        .eq("id", String(record.id))
        .maybeSingle();

      if (attendanceError) {
        throw new Error(`Attendance lookup failed: ${attendanceError.message}`);
      }

      if (attendanceRow) {
        record = { ...attendanceRow, ...record };
      }
    }

    if (!record.user_id || !record.branch_id) {
      return new Response(JSON.stringify({ error: "Attendance record is missing user_id or branch_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let staffName = String(record.user_id);
    let staffId = String(record.user_id);
    const { data: staffProfile, error: staffError } = await supabase
      .from("staff_profiles")
      .select("name, staff_id")
      .eq("user_id", String(record.user_id))
      .maybeSingle();

    if (staffError) {
      console.warn("Staff lookup failed, using fallback:", staffError.message);
    } else if (staffProfile) {
      staffName = staffProfile.name || staffProfile.staff_id || String(record.user_id);
      staffId = staffProfile.staff_id || String(record.user_id);
    }

    let branchName = String(record.branch_id);
    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("name")
      .eq("id", String(record.branch_id))
      .maybeSingle();

    if (branchError) {
      console.warn("Branch lookup failed, using fallback:", branchError.message);
    } else if (branch?.name) {
      branchName = branch.name;
    }

    const isCheckOut = Boolean(record.check_out_time);
    const actionEmoji = isCheckOut ? "🚩" : "✅";
    const actionLabel = isCheckOut ? "Check-out" : "Check-in";
    const eventTimestamp = record.check_out_time ?? record.check_in_time;

    if (!eventTimestamp) {
      return new Response(JSON.stringify({ error: "Attendance record is missing check_in_time/check_out_time" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventTime = new Date(String(eventTimestamp)).toLocaleString("en-MY", {
      timeZone: "Asia/Kuala_Lumpur",
    });

    const lateMinutes = Number(record.late_minutes ?? 0);
    const lateInfo = !isCheckOut && lateMinutes > 0 ? `\n⚠️ Late: ${lateMinutes} min` : "";

    const message =
      `${actionEmoji} <b>Attendance ${actionLabel}</b>\n\n` +
      `👤 Name: <b>${escapeHtml(staffName)}</b>${staffId && staffId !== staffName ? ` (${escapeHtml(staffId)})` : ""}\n` +
      `📍 Branch: ${escapeHtml(branchName)}\n` +
      `🕐 Time: ${escapeHtml(eventTime)}` +
      lateInfo;

    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Telegram API failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("notify-attendance error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});