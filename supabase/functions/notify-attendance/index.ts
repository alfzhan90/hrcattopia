import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY is not configured");

    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TELEGRAM_CHAT_ID) throw new Error("TELEGRAM_CHAT_ID is not configured");

    const body = await req.json();
    const record = body.record;

    if (!record) {
      return new Response(JSON.stringify({ error: "No record provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create service-role client for lookups
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Lookup staff name by user_id
    let staffName = record.user_id ?? "Unknown";
    let staffId = "";
    try {
      const { data: staffProfile } = await supabase
        .from("staff_profiles")
        .select("name, staff_id")
        .eq("user_id", record.user_id)
        .single();
      if (staffProfile) {
        staffName = staffProfile.name;
        staffId = staffProfile.staff_id ?? "";
      }
    } catch (e) {
      console.warn("Staff lookup failed, using fallback:", e);
    }

    // Lookup branch name by branch_id
    let branchName = record.branch_id ?? "Unknown";
    try {
      const { data: branch } = await supabase
        .from("branches")
        .select("name")
        .eq("id", record.branch_id)
        .single();
      if (branch) {
        branchName = branch.name;
      }
    } catch (e) {
      console.warn("Branch lookup failed, using fallback:", e);
    }

    // Determine if check-in or check-out
    const isCheckOut = !!record.check_out_time;
    const actionEmoji = isCheckOut ? "🚩" : "✅";
    const actionLabel = isCheckOut ? "Check-out" : "Check-in";

    const eventTime = new Date(
      isCheckOut ? record.check_out_time : record.check_in_time
    ).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });

    const lateInfo =
      !isCheckOut && record.late_minutes > 0
        ? `\n⚠️ Late: ${record.late_minutes} min`
        : "";

    const message =
      `${actionEmoji} <b>Attendance ${actionLabel}</b>\n\n` +
      `👤 Name: <b>${staffName}</b>${staffId ? ` (${staffId})` : ""}\n` +
      `📍 Branch: ${branchName}\n` +
      `🕐 Time: ${eventTime}` +
      lateInfo;

    const response = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
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
    console.error("notify-attendance error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
