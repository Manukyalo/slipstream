import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limiter.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Standard client to verify caller identity
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate-limit account deletion requests
    const rateLimit = await checkRateLimit(`delete-account:${user.id}`, 2, 3600);
    if (!rateLimit.success) {
      return new Response(
        JSON.stringify({ error: 'Too many deletion attempts. Please wait.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Ensure explicit confirmation payload
    const body = await req.json().catch(() => ({}));
    if (body.confirmation !== 'DELETE') {
      return new Response(
        JSON.stringify({
          error: 'Explicit confirmation required. Payload must contain {"confirmation": "DELETE"}.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Admin client with service-role key to invoke auth.admin.deleteUser
    if (!supabaseServiceKey) {
      // Fallback to calling Postgres delete_user_account RPC
      const { error: rpcError } = await supabase.rpc('delete_user_account');
      if (rpcError) {
        return new Response(
          JSON.stringify({ error: 'Account deletion failed: ' + rpcError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    } else {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Admin account deletion failed: ' + deleteError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account and all associated telemetry records permanently deleted.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
