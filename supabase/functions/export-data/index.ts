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

    // Rate-limit exports per user: max 3 per hour (3600s) to prevent DB scraping
    const rateLimit = await checkRateLimit(`export:${user.id}`, 3, 3600);
    const rateLimitHeaders = {
      'X-RateLimit-Limit': String(rateLimit.limit),
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset': String(rateLimit.reset),
    };

    if (!rateLimit.success) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded: Max 3 data exports per hour. Please try again later.',
        }),
        {
          status: 429,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Call Postgres export_user_data RPC
    const { data, error: rpcError } = await supabase.rpc('export_user_data');

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: 'Export failed: ' + rpcError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        ...rateLimitHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="slipstream-export-${user.id}.json"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
