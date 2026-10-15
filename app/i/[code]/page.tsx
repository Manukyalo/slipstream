import React from 'react';

export interface PageMetadata {
  title?: string;
  description?: string;
  openGraph?: Record<string, unknown>;
  twitter?: Record<string, unknown>;
}

interface PageProps {
  params: Promise<{ code: string }> | { code: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://zzfjvhbuhsugwztllxco.supabase.co';
// Must be injected via environment — never hardcoded. Graceful degradation: page renders with generic title if missing.
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';
const APP_BASE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.EXPO_PUBLIC_APP_URL ||
  'https://slipstream-app.vercel.app'
).replace(/\/+$/, '');

async function getInviter(code: string): Promise<string | null> {
  const clean = code.trim().toUpperCase();
  if (!clean || !SUPABASE_ANON_KEY) return null;

  try {
    const url = `${SUPABASE_URL}/rest/v1/profiles?referral_code=eq.${encodeURIComponent(clean)}&select=display_name`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (res.ok) {
      const data = (await res.json()) as { display_name?: string }[];
      if (data && data.length > 0 && data[0].display_name) {
        return data[0].display_name.trim();
      }
    }
  } catch {
    // Graceful fallback
  }

  return null;
}

export async function generateMetadata(props: PageProps): Promise<PageMetadata> {
  const resolvedParams = await Promise.resolve(props.params);
  const code = (resolvedParams.code || '').trim().toUpperCase();
  const inviter = await getInviter(code);

  const title = inviter
    ? `${inviter} invited you to Slipstream`
    : 'Join Slipstream — Telemetry, Drag Timer & Radar Alerts';
  const description =
    'Precision GPS telemetry, 0-100 & 1/4-mile drag timer, live radar alerts, and track day telemetry. Join the motorsport community.';
  const url = `${APP_BASE_URL}/i/${code}`;
  const ogImage = `${APP_BASE_URL}/og-image.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Slipstream Telemetry',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: 'Slipstream Motorsport Telemetry HUD',
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function InvitePage(props: PageProps) {
  const resolvedParams = await Promise.resolve(props.params);
  const code = (resolvedParams.code || '').trim().toUpperCase();
  const inviterName = await getInviter(code);

  const playStoreUrl = `https://play.google.com/store/apps/details?id=com.slipstream.app&referrer=invite_${encodeURIComponent(code || 'SLIPSTREAM')}`;
  const appStoreUrl = 'https://apps.apple.com/app/com.slipstream.app/id6470000000';
  const deepLink = code ? `slipstream://i/${code}` : 'slipstream://';

  return (
    <main style={{
      backgroundColor: '#080B14',
      color: '#F8FAFC',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        maxWidth: '520px',
        width: '100%',
        background: '#0E1322',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        padding: '32px 24px',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 14px',
          background: 'rgba(0, 245, 255, 0.1)',
          border: '1px solid rgba(0, 245, 255, 0.3)',
          borderRadius: '999px',
          color: '#00F5FF',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '20px'
        }}>
          ● Slipstream Motorsport Telemetry
        </div>

        <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '10px', color: '#FFF' }}>
          {inviterName ? (
            <>
              <span style={{ color: '#00F5FF' }}>{inviterName}</span> invited you to race
            </>
          ) : (
            'Join Slipstream Telemetry'
          )}
        </h1>

        <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '24px' }}>
          Real-time GPS telemetry, 0-100 & 1/4-mile drag timer, live speed camera radar, and track day session logs.
        </p>

        <div style={{
          background: '#151C30',
          border: '1px dashed rgba(0, 245, 255, 0.4)',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>DRIVER INVITE CODE</div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '18px',
              fontWeight: 700,
              color: '#FFB800',
              letterSpacing: '0.1em'
            }}>
              {code || 'SLIPSTREAM'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <a
            href={playStoreUrl}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px 20px',
              borderRadius: '14px',
              background: '#00F5FF',
              color: '#080B14',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '14px'
            }}
          >
            Get on Google Play (Passes Code)
          </a>

          <a
            href={appStoreUrl}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px 20px',
              borderRadius: '14px',
              background: '#1E293B',
              color: '#FFF',
              border: '1px solid rgba(255,255,255,0.1)',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '14px'
            }}
          >
            Download on App Store
          </a>

          <a
            href={deepLink}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '14px 20px',
              borderRadius: '14px',
              background: 'rgba(255, 184, 0, 0.12)',
              color: '#FFB800',
              border: '1px solid rgba(255, 184, 0, 0.3)',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '14px'
            }}
          >
            Open in Slipstream App
          </a>
        </div>
      </div>
    </main>
  );
}
