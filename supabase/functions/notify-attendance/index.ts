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

    // Look up staff name and branch name
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: staffProfile } = await supabase
      .from("staff_profiles")
      .select("name, staff_id")
      .eq("user_id", record.user_id)
      .single();

    const { data: branch } = await supabase
      .from("branches")
      .select("name")
      .eq("id", record.branch_id)
      .single();

    const staffName = staffProfile?.name ?? "Unknown";
    const staffId = staffProfile?.staff_id ?? "";
    const branchName = branch?.name ?? "Unknown";
    const checkInTime = new Date(record.check_in_time).toLocaleString("en-MY", {
      timeZone: "Asia/Kuala_Lumpur",
    });
    const status = record.status === "late" ? "⚠️ LATE" : "✅ On Time";

    const message =
      `📋 <b>Attendance Logged</b>\n\n` +
      `👤 <b>${staffName}</b> (${staffId})\n` +
      `📍 Branch: ${branchName}\n` +
      `🕐 Check-in: ${checkInTime}\n` +
      `${status}` +
      (record.late_minutes > 0 ? ` (${record.late_minutes} min late)` : "");

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
