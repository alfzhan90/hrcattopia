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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", caller.id).eq("role", "admin").maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Resend invitation/verification action
    if (action === "resend_invite") {
      const { staff_profile_id } = body;
      if (!staff_profile_id) {
        return new Response(JSON.stringify({ error: "staff_profile_id is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await adminClient
        .from("staff_profiles").select("user_id, email")
        .eq("id", staff_profile_id).single();

      if (!profile || !profile.email) {
        return new Response(JSON.stringify({ error: "Profile or email not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Re-invite the user by generating a new invite link
      const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(profile.email);

      if (inviteError) {
        // If user already confirmed, try generating a magic link instead
        if (inviteError.message?.includes("already been registered")) {
          // User already confirmed — just let admin know
          return new Response(
            JSON.stringify({ success: true, message: "User already verified. No action needed.", already_verified: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify({ error: inviteError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Verification email resent successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default action: update email
    const { staff_profile_id, new_email } = body;

    if (!staff_profile_id || !new_email) {
      return new Response(JSON.stringify({ error: "staff_profile_id and new_email are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the user_id from staff_profiles
    const { data: profile, error: profileError } = await adminClient
      .from("staff_profiles").select("user_id, email")
      .eq("id", staff_profile_id).single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Staff profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Force-update auth email instantly (no confirmation required for admin actions)
    const { error: authError } = await adminClient.auth.admin.updateUserById(
      profile.user_id,
      { 
        email: new_email,
        email_confirm: true,  // Instantly confirm — admin override
      }
    );

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update email in staff_profiles
    await adminClient.from("staff_profiles")
      .update({ email: new_email })
      .eq("id", staff_profile_id);

    return new Response(
      JSON.stringify({ success: true, message: "Email updated successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
