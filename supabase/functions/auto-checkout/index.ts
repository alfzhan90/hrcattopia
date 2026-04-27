// Auto-Checkout Edge Function
// Runs daily at 20:30 (8:30 PM) Asia/Kuala_Lumpur via pg_cron.
// Closes any attendance log that has a check_in_time today but no check_out_time.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AUTO_REMARK = "🤖 System Auto-Checkout";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Optional override for ad-hoc/manual runs (not used by cron).
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";

    // Compute "today" in Asia/Kuala_Lumpur (UTC+8). Cron fires at 20:30 MYT
    // which is 12:30 UTC, so "today" in MYT corresponds to current UTC date.
    const now = new Date();
    const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const yyyy = myt.getUTCFullYear();
    const mm = String(myt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(myt.getUTCDate()).padStart(2, "0");
    const hh = myt.getUTCHours();
    const mn = myt.getUTCMinutes();
    const todayStart = `${yyyy}-${mm}-${dd}T00:00:00+08:00`;
    const todayEnd = `${yyyy}-${mm}-${dd}T23:59:59+08:00`;

    // GUARD: Never auto-checkout today's records before 20:30 MYT.
    // Today's open sessions are still "Active" until the cutoff arrives.
    const beforeCutoff = hh < 20 || (hh === 20 && mn < 30);
    if (beforeCutoff && !force) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: true,
          reason: `Current MYT time ${String(hh).padStart(2, "0")}:${String(mn).padStart(2, "0")} is before 20:30 cutoff. No action taken.`,
          scanned: 0,
          updated: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Force checkout time to 20:30 MYT today
    const checkoutAt = new Date(`${yyyy}-${mm}-${dd}T20:30:00+08:00`);

    // Find open logs from today
    const { data: openLogs, error: fetchErr } = await supabase
      .from("attendance_logs")
      .select("id, user_id, check_in_time, manager_notes")
      .gte("check_in_time", todayStart)
      .lte("check_in_time", todayEnd)
      .is("check_out_time", null);

    if (fetchErr) throw fetchErr;

    let updated = 0;
    for (const log of openLogs ?? []) {
      const checkIn = new Date(log.check_in_time);
      const totalHours = Math.max(
        (checkoutAt.getTime() - checkIn.getTime()) / (1000 * 60 * 60),
        0,
      );
      const restHours = Math.floor(totalHours / 5);
      const netHours = Math.max(totalHours - restHours, 0);
      const regularHours = Math.min(netHours, 8);
      const otHours = Math.max(netHours - 8, 0);

      const existing = log.manager_notes ?? "";
      const newNote = existing.includes(AUTO_REMARK)
        ? existing
        : (existing ? `${existing} | ${AUTO_REMARK}` : AUTO_REMARK);

      const { error: updErr } = await supabase
        .from("attendance_logs")
        .update({
          check_out_time: checkoutAt.toISOString(),
          net_hours: Math.round(netHours * 100) / 100,
          rest_hours: Math.round(restHours * 100) / 100,
          regular_hours: Math.round(regularHours * 100) / 100,
          ot_hours: Math.round(otHours * 100) / 100,
          manager_notes: newNote,
        })
        .eq("id", log.id);

      if (!updErr) updated++;
      else console.error("auto-checkout update failed", log.id, updErr.message);
    }

    return new Response(
      JSON.stringify({ ok: true, scanned: openLogs?.length ?? 0, updated }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("auto-checkout error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
