import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import qrcode from 'https://esm.sh/qrcode-generator@1.4.4';
import { corsHeaders } from '../_shared/cors.ts';
import { checkRateLimit } from '../_shared/rate-limiter.ts';

interface RecapCardRequest {
  type: 'trip' | 'drag' | 'sprint';
  id?: string;
  // Fallback/direct properties if rendering before DB commit
  headline?: string;
  vehicleName?: string;
  topSpeedKmh?: number;
  elapsedMs?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  referralCode?: string;
  routePoints?: [number, number][]; // [lon, lat] pairs for route thumbnail
}

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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: 20 card generations per 5 minutes
    const rateLimit = await checkRateLimit(`recap:${user.id}`, 20, 300);
    if (!rateLimit.success) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded: Too many card requests. Please slow down.' }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const body: RecapCardRequest = await req.json().catch(() => ({ type: 'trip' }));

    let headline = body.headline ?? 'TELEMETRY BENCHMARK';
    let vehicleName = body.vehicleName ?? 'SLIPSTREAM PILOT';
    let topSpeedKmh = body.topSpeedKmh ?? 0;
    let elapsedMs = body.elapsedMs ?? 0;
    let distanceMeters = body.distanceMeters ?? 0;
    let durationSeconds = body.durationSeconds ?? 0;
    let referralCode = body.referralCode ?? '';
    let routePoints = body.routePoints ?? [];

    // Fetch user referral code if not provided
    if (!referralCode) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();
      if (profile?.referral_code) {
        referralCode = profile.referral_code;
      }
    }

    // If ID provided, hydrate directly from database for authenticity
    if (body.id && body.type === 'trip') {
      const { data: trip } = await supabase
        .from('trips')
        .select('*, vehicles(make, model, year)')
        .eq('id', body.id)
        .single();

      if (trip) {
        headline = 'HIGH-SPEED RUN';
        topSpeedKmh = Number(trip.top_speed_kmh) || 0;
        distanceMeters = Number(trip.distance_m) || 0;
        durationSeconds = Number(trip.duration_s) || 0;
        if (trip.vehicles) {
          vehicleName = `${trip.vehicles.year ?? ''} ${trip.vehicles.make} ${trip.vehicles.model}`.trim();
        }
        if (trip.route_geojson && trip.route_geojson.coordinates) {
          routePoints = trip.route_geojson.coordinates.map((c: number[]) => [c[0], c[1]]);
        }
      }
    } else if (body.id && (body.type === 'drag' || body.type === 'sprint')) {
      const { data: run } = await supabase
        .from('drag_runs')
        .select('*, vehicles(make, model, year)')
        .eq('id', body.id)
        .single();

      if (run) {
        const typeLabel =
          run.run_type === 'zero_to_60'
            ? '0–60 MPH SPRINT'
            : run.run_type === 'zero_to_100'
            ? '0–100 KM/H SPRINT'
            : run.distance_type === 'quarter_mile'
            ? '1/4 MILE PASS'
            : run.distance_type === 'half_mile'
            ? '1/2 MILE PASS'
            : '1 MILE MAXIMUM';
        headline = typeLabel;
        topSpeedKmh = Number(run.top_speed) || 0;
        elapsedMs = Number(run.elapsed_ms) || 0;
        if (run.vehicles) {
          vehicleName = `${run.vehicles.year ?? ''} ${run.vehicles.make} ${run.vehicles.model}`.trim();
        }
      }
    }

    // Generate QR Code SVG for user's referral link
    const inviteUrl = referralCode
      ? `https://slipstream.app/i/${referralCode}`
      : 'https://slipstream.app';
    const qr = qrcode(0, 'M');
    qr.addData(inviteUrl);
    qr.make();
    const qrModuleCount = qr.getModuleCount();
    const qrSize = 140;
    const qrCellSize = qrSize / qrModuleCount;
    let qrSvgPaths = '';
    for (let r = 0; r < qrModuleCount; r++) {
      for (let c = 0; c < qrModuleCount; c++) {
        if (qr.isDark(r, c)) {
          const x = (860 + c * qrCellSize).toFixed(2);
          const y = (1680 + r * qrCellSize).toFixed(2);
          const w = qrCellSize.toFixed(2);
          const h = qrCellSize.toFixed(2);
          qrSvgPaths += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#00D4FF" />`;
        }
      }
    }

    // Build route thumbnail polyline if coordinates available
    let routeSvg = '';
    if (routePoints.length >= 2) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const [x, y] of routePoints) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const rangeX = maxX - minX || 0.001;
      const rangeY = maxY - minY || 0.001;
      const mapBoxWidth = 880;
      const mapBoxHeight = 360;
      const mapBoxLeft = 100;
      const mapBoxTop = 1080;

      const polylinePoints = routePoints
        .map(([x, y]) => {
          const normX = ((x - minX) / rangeX) * (mapBoxWidth - 40) + mapBoxLeft + 20;
          // Invert Y for screen coords
          const normY = mapBoxTop + mapBoxHeight - 20 - ((y - minY) / rangeY) * (mapBoxHeight - 40);
          return `${normX.toFixed(1)},${normY.toFixed(1)}`;
        })
        .join(' ');

      routeSvg = `
        <rect x="100" y="1060" width="880" height="400" rx="24" fill="#0F1421" stroke="#273147" stroke-width="2"/>
        <polyline points="${polylinePoints}" fill="none" stroke="#00D4FF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="${polylinePoints}" fill="none" stroke="#00D4FF" stroke-width="14" opacity="0.25" stroke-linecap="round" stroke-linejoin="round"/>
      `;
    } else {
      // Drag/Sprint trajectory graphic
      routeSvg = `
        <rect x="100" y="1060" width="880" height="400" rx="24" fill="#0F1421" stroke="#273147" stroke-width="2"/>
        <line x1="160" y1="1260" x2="920" y2="1260" stroke="#273147" stroke-width="4" stroke-dasharray="16,16"/>
        <line x1="160" y1="1260" x2="840" y2="1260" stroke="#FF6B35" stroke-width="8" stroke-linecap="round"/>
        <circle cx="840" cy="1260" r="14" fill="#FF6B35" filter="drop-shadow(0 0 12px #FF6B35)"/>
        <text x="540" y="1380" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="28" fill="#8B96B0" text-anchor="middle" letter-spacing="4">TELEMETRY BENCHMARK STRIP</text>
      `;
    }

    const formattedElapsed = (elapsedMs / 1000).toFixed(2);
    const formattedDuration = `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;
    const formattedDistKm = (distanceMeters / 1000).toFixed(1);

    // Primary hero stat based on mode
    const isDragOrSprint = body.type === 'drag' || body.type === 'sprint' || elapsedMs > 0;
    const heroValue = isDragOrSprint ? `${formattedElapsed}s` : `${topSpeedKmh.toFixed(0)}`;
    const heroUnit = isDragOrSprint ? 'ELAPSED' : 'KM/H TOP SPEED';

    // 1080x1920 Story Card SVG (Rich Dark Cockpit Aesthetic)
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1080" y2="1920" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0F1421" />
      <stop offset="45%" stop-color="#080B14" />
      <stop offset="100%" stop-color="#04060A" />
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#00D4FF" />
      <stop offset="100%" stop-color="#00FFC2" />
    </linearGradient>
    <linearGradient id="orangeGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FF6B35" />
      <stop offset="100%" stop-color="#FF9F1C" />
    </linearGradient>
    <radialGradient id="ambientGlow" cx="50%" cy="25%" r="45%">
      <stop offset="0%" stop-color="rgba(0, 212, 255, 0.12)" />
      <stop offset="100%" stop-color="rgba(0, 0, 0, 0)" />
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1920" fill="url(#bgGrad)"/>
  <rect width="1080" height="1920" fill="url(#ambientGlow)"/>

  <!-- Top App Brand Bar -->
  <g transform="translate(100, 140)">
    <!-- Slipstream Brand Wordmark & Icon -->
    <rect x="0" y="0" width="48" height="48" rx="12" fill="#00D4FF" />
    <polygon points="14,14 34,24 14,34" fill="#080B14"/>
    <text x="68" y="34" font-family="'Space Grotesk', -apple-system, sans-serif" font-weight="900" font-size="34" fill="#EDF1FB" letter-spacing="6">SLIPSTREAM</text>
    <text x="980" y="34" font-family="'Space Grotesk', -apple-system, sans-serif" font-weight="700" font-size="20" fill="#00D4FF" letter-spacing="3" text-anchor="end">PRO TELEMETRY</text>
  </g>

  <!-- Header Category Badge & Vehicle -->
  <g transform="translate(100, 280)">
    <rect x="0" y="0" width="340" height="52" rx="26" fill="rgba(0, 212, 255, 0.12)" stroke="#00D4FF" stroke-width="1.5"/>
    <text x="170" y="34" font-family="'Space Grotesk', sans-serif" font-weight="800" font-size="20" fill="#00D4FF" letter-spacing="3" text-anchor="middle">${headline.toUpperCase()}</text>

    <!-- Vehicle Name -->
    <text x="0" y="120" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="38" fill="#EDF1FB" letter-spacing="1">🏎️ ${vehicleName.toUpperCase()}</text>
  </g>

  <!-- Primary Giant Hero Metric Display -->
  <g transform="translate(100, 520)">
    <rect x="0" y="0" width="880" height="340" rx="32" fill="#0F1421" stroke="#273147" stroke-width="2"/>
    <text x="60" y="80" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="24" fill="#8B96B0" letter-spacing="4">${heroUnit}</text>
    <text x="60" y="240" font-family="'Space Grotesk', sans-serif" font-weight="900" font-size="140" fill="url(#cyanGrad)" letter-spacing="-2">${heroValue}</text>
  </g>

  <!-- Secondary Metrics Grid -->
  <g transform="translate(100, 890)">
    <!-- Card 1 -->
    <rect x="0" y="0" width="273" height="140" rx="20" fill="#181E2E" stroke="#273147" stroke-width="1.5"/>
    <text x="32" y="44" font-family="'Space Grotesk', sans-serif" font-weight="600" font-size="16" fill="#8B96B0" letter-spacing="2">TOP SPEED</text>
    <text x="32" y="100" font-family="'Space Grotesk', sans-serif" font-weight="800" font-size="36" fill="#EDF1FB">${topSpeedKmh.toFixed(0)} <tspan font-size="20" fill="#8B96B0">km/h</tspan></text>

    <!-- Card 2 -->
    <rect x="303" y="0" width="273" height="140" rx="20" fill="#181E2E" stroke="#273147" stroke-width="1.5"/>
    <text x="335" y="44" font-family="'Space Grotesk', sans-serif" font-weight="600" font-size="16" fill="#8B96B0" letter-spacing="2">DISTANCE</text>
    <text x="335" y="100" font-family="'Space Grotesk', sans-serif" font-weight="800" font-size="36" fill="#EDF1FB">${formattedDistKm} <tspan font-size="20" fill="#8B96B0">km</tspan></text>

    <!-- Card 3 -->
    <rect x="606" y="0" width="274" height="140" rx="20" fill="#181E2E" stroke="#273147" stroke-width="1.5"/>
    <text x="638" y="44" font-family="'Space Grotesk', sans-serif" font-weight="600" font-size="16" fill="#8B96B0" letter-spacing="2">DURATION</text>
    <text x="638" y="100" font-family="'Space Grotesk', sans-serif" font-weight="800" font-size="32" fill="#EDF1FB">${formattedDuration}</text>
  </g>

  <!-- Route / Strip Visualizer -->
  ${routeSvg}

  <!-- Footer Invite / QR Code Section -->
  <g transform="translate(100, 1660)">
    <rect x="0" y="0" width="880" height="180" rx="24" fill="#0F1421" stroke="#273147" stroke-width="2"/>
    <text x="40" y="60" font-family="'Space Grotesk', sans-serif" font-weight="800" font-size="26" fill="#EDF1FB" letter-spacing="2">JOIN THE CREW ON SLIPSTREAM</text>
    <text x="40" y="100" font-family="'Space Grotesk', sans-serif" font-weight="500" font-size="18" fill="#8B96B0">Scan with phone camera to compare telemetry</text>
    ${
      referralCode
        ? `<text x="40" y="145" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="18" fill="#00D4FF" letter-spacing="1">REFERRAL: ${referralCode}</text>`
        : ''
    }
  </g>

  <!-- QR Code Matrix -->
  <g>
    <rect x="850" y="1670" width="160" height="160" rx="16" fill="#080B14" stroke="#00D4FF" stroke-width="2"/>
    ${qrSvgPaths}
  </g>
</svg>`;

    return new Response(svg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown generation failure';
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
