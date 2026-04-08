import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin using their JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      email,
      name,
      ic_number,
      kwsp_number,
      socso_number,
      employment_type,
      base_rate,
      ot_rate_per_hour,
      branch_id,
      phone_number,
      bank_name,
      bank_account_number,
    } = body;

    if (!email || !name || !ic_number) {
      return new Response(
        JSON.stringify({ error: "Email, name, and IC number are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invite user by email
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name },
      });

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = inviteData.user.id;

    // Check if staff profile already exists for this user
    const { data: existingProfile } = await adminClient
      .from("staff_profiles")
      .select("id")
      .eq("user_id", newUserId)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ success: true, user_id: newUserId, message: "Staff member already exists. Invite re-sent." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create staff profile
    const { error: profileError } = await adminClient
      .from("staff_profiles")
      .insert({
        user_id: newUserId,
        name,
        ic_number,
        kwsp_number: kwsp_number || null,
        socso_number: socso_number || null,
        employment_type: employment_type || "Monthly-FT",
        base_rate: parseFloat(base_rate) || 0,
        ot_rate_per_hour: parseFloat(ot_rate_per_hour) || 0,
        branch_id: branch_id || null,
        phone_number: phone_number || null,
        bank_name: bank_name || null,
        bank_account_number: bank_account_number || null,
        staff_id: "auto", // trigger overrides
      });

    if (profileError) {
      return new Response(
        JSON.stringify({ error: `Invite sent but profile creation failed: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assign staff role
    await adminClient.from("user_roles").insert({
      user_id: newUserId,
      role: "staff",
    });

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
