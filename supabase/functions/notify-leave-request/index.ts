// Notify admin of new leave request via Telegram
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
    if (!TELEGRAM_API_KEY || !TELEGRAM_CHAT_ID) {
      throw new Error("Telegram secrets not configured");
    }

    const body = await req.json();
    const { staff_name, leave_type, start_date, end_date, reason } = body ?? {};
    if (!staff_name || !leave_type || !start_date) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const typeLabels: Record<string, string> = {
      AL: "Annual Leave", MC: "Medical Leave", EL: "Emergency Leave", UPL: "Unpaid Leave",
    };
    const lt = typeLabels[leave_type] || leave_type;
    const range = end_date && end_date !== start_date ? `${start_date} → ${end_date}` : start_date;
    const text =
      `📩 <b>New Leave Request</b>\n` +
      `<b>${escapeHtml(staff_name)}</b> applied for <b>${escapeHtml(lt)}</b>\n` +
      `Dates: ${escapeHtml(range)}` +
      (reason ? `\nReason: ${escapeHtml(String(reason))}` : "");

    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Telegram failed [${res.status}]: ${JSON.stringify(data)}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-leave-request error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
