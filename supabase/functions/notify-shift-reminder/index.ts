// Send shift reminders for tomorrow to admin Telegram
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !TELEGRAM_CHAT_ID) {
      throw new Error("Telegram secrets not configured");
    }

    // Payload: { date_label: "Thu, 9 May", shifts: [{ staff_name, branch_name, start_time, end_time }] }
    const body = await req.json();
    const { date_label, shifts } = body ?? {};

    if (!date_label || !Array.isArray(shifts)) {
      return new Response(JSON.stringify({ error: "Missing date_label or shifts" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (shifts.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lines = (shifts as any[]).map((s) =>
      `• <b>${escapeHtml(s.staff_name)}</b> → ${escapeHtml(s.branch_name)} | ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`
    );

    const text =
      `📋 <b>Shift Reminders — Tomorrow (${escapeHtml(date_label)})</b>\n\n` +
      lines.join("\n");

    const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TELEGRAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Telegram failed [${res.status}]: ${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ ok: true, sent: shifts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-shift-reminder error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
