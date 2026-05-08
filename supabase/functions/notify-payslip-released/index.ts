// Notify admin when a payslip (or all payslips) is released
const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const escapeHtml = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const fmt = (n: number) =>
  n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !TELEGRAM_CHAT_ID) {
      throw new Error("Telegram secrets not configured");
    }

    const body = await req.json();
    // Single release: { staff_name, staff_id, month, net_pay }
    // Bulk release:   { bulk: true, count, month, total_pay }
    let text: string;

    if (body?.bulk) {
      const { count, month, total_pay } = body;
      text =
        `💰 <b>All Payslips Released</b>\n\n` +
        `📅 Month: <b>${escapeHtml(String(month))}</b>\n` +
        `👥 Staff count: ${Number(count)}\n` +
        `💵 Total net pay: <b>RM ${fmt(Number(total_pay))}</b>`;
    } else {
      const { staff_name, staff_id, month, net_pay } = body ?? {};
      if (!staff_name || !month) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      text =
        `💰 <b>Payslip Released</b>\n\n` +
        `👤 <b>${escapeHtml(String(staff_name))}</b>${staff_id ? ` (${escapeHtml(String(staff_id))})` : ""}\n` +
        `📅 Month: ${escapeHtml(String(month))}\n` +
        `💵 Net pay: <b>RM ${fmt(Number(net_pay))}</b>`;
    }

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

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-payslip-released error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
