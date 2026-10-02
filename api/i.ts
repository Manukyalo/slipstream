interface VercelRequest {
  query: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}

interface VercelResponse {
  status(code: number): this;
  setHeader(name: string, value: string | string[]): this;
  send(body: string): void;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zzfjvhbuhsugwztllxco.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6Zmp2aGJ1aHN1Z3d6dGxseGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTYwOTIsImV4cCI6MjEwNTkzMjA5Mn0.BJ5UtkpSabu4plR4CtHYlKKZkBxWOHzm8AnhJ3fRN5Q';
const APP_BASE_URL = (
  process.env.EXPO_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://slipstream-app.vercel.app'
).replace(/\/+$/, '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawCode = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
  const cleanCode = (rawCode || '').trim().toUpperCase();

  let inviterName: string | null = null;

  if (cleanCode) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/profiles?referral_code=eq.${encodeURIComponent(cleanCode)}&select=display_name`;
      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (response.ok) {
        const rows = (await response.json()) as Array<{ display_name?: string }>;
        if (rows && rows.length > 0 && rows[0].display_name) {
          inviterName = rows[0].display_name.trim();
        }
      }
    } catch {
      // Graceful degradation: never crash or 404
      inviterName = null;
    }
  }

  const title = inviterName
    ? `${inviterName} invited you to Slipstream`
    : 'Join Slipstream — Telemetry, Drag Timer & Radar Alerts';
  const description =
    'High-performance precision GPS telemetry, 0-100 & 1/4-mile drag timer, live radar speed camera alerts, and track day lap delta analysis.';
  const ogImageUrl = `${APP_BASE_URL}/og-image.png`;
  const inviteUrl = cleanCode ? `${APP_BASE_URL}/i/${cleanCode}` : APP_BASE_URL;
  const playStoreUrl = `https://play.google.com/store/apps/details?id=com.slipstream.app&referrer=invite_${encodeURIComponent(cleanCode || 'SLIPSTREAM')}`;
  const appStoreUrl = 'https://apps.apple.com/app/com.slipstream.app/id6470000000';
  const deepLink = cleanCode ? `slipstream://i/${cleanCode}` : 'slipstream://';

  // Set attribution cookie: 30 days
  if (cleanCode) {
    res.setHeader(
      'Set-Cookie',
      `slipstream_invite_code=${cleanCode}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`,
    );
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <!-- Open Graph / WhatsApp / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Slipstream Telemetry" />
  <meta property="og:url" content="${escapeHtml(inviteUrl)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Slipstream Motorsport Telemetry HUD" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${escapeHtml(inviteUrl)}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />

  <!-- Theme Color -->
  <meta name="theme-color" content="#080B14" />
  <link rel="icon" type="image/png" href="/favicon.png" />

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #080B14;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justifyContent: center;
      padding: 24px 16px;
      line-height: 1.5;
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(0, 245, 255, 0.12) 0%, transparent 60%),
        radial-gradient(circle at 100% 100%, rgba(255, 184, 0, 0.08) 0%, transparent 50%);
    }
    .wrapper {
      max-width: 520px;
      width: 100%;
      background: #0E1322;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 32px 24px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: rgba(0, 245, 255, 0.1);
      border: 1px solid rgba(0, 245, 255, 0.3);
      border-radius: 999px;
      color: #00F5FF;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #00F5FF;
      box-shadow: 0 0 8px #00F5FF;
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
      color: #FFFFFF;
    }
    .accent-name {
      color: #00F5FF;
    }
    p.lead {
      color: #94A3B8;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .code-box {
      background: #151C30;
      border: 1px dashed rgba(0, 245, 255, 0.4);
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .code-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      letter-spacing: 0.06em;
      text-align: left;
    }
    .code-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 18px;
      font-weight: 700;
      color: #FFB800;
      letter-spacing: 0.1em;
    }
    .features-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 28px;
      text-align: left;
    }
    .feature-item {
      background: #121829;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 12px;
    }
    .feature-title {
      font-size: 12px;
      font-weight: 700;
      color: #E2E8F0;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .feature-desc {
      font-size: 11px;
      color: #64748B;
      line-height: 1.3;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 20px;
      border-radius: 14px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-primary {
      background: #00F5FF;
      color: #080B14;
      box-shadow: 0 4px 16px rgba(0, 245, 255, 0.3);
    }
    .btn-primary:hover {
      background: #33F7FF;
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: #1E293B;
      color: #F8FAFC;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .btn-secondary:hover {
      background: #334155;
    }
    .btn-app {
      background: rgba(255, 184, 0, 0.12);
      color: #FFB800;
      border: 1px solid rgba(255, 184, 0, 0.3);
    }
    .btn-app:hover {
      background: rgba(255, 184, 0, 0.2);
    }
    footer {
      margin-top: 24px;
      font-size: 11px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="badge">
      <span class="pulse-dot"></span>
      Slipstream Motorsport Telemetry
    </div>

    <h1>
      ${inviterName ? `<span class="accent-name">${escapeHtml(inviterName)}</span> invited you to race` : 'Join Slipstream Telemetry'}
    </h1>
    <p class="lead">
      Real-time GPS telemetry, 0-100 & 1/4-mile drag timer, live speed camera radar, and track day session logs.
    </p>

    <div class="code-box">
      <div>
        <div class="code-label">DRIVER INVITE CODE</div>
        <div class="code-value">${escapeHtml(cleanCode || 'SLIPSTREAM')}</div>
      </div>
      <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 11px;" onclick="copyCode()">Copy</button>
    </div>

    <div class="features-list">
      <div class="feature-item">
        <div class="feature-title">⚡ Drag Timer</div>
        <div class="feature-desc">0-60, 0-100, 100-200 & 1/4 mile runs with 0.01s GPS precision.</div>
      </div>
      <div class="feature-item">
        <div class="feature-title">📡 Radar Alerts</div>
        <div class="feature-desc">Live speed cameras, red-light traps, and police hazard beacons.</div>
      </div>
      <div class="feature-item">
        <div class="feature-title">🏎️ Track Day</div>
        <div class="feature-desc">Automatic lap detection, delta splits, and trajectory heatmaps.</div>
      </div>
      <div class="feature-item">
        <div class="feature-title">🔧 Garage Log</div>
        <div class="feature-desc">Digital maintenance logbook, tire wear, and vehicle telemetry.</div>
      </div>
    </div>

    <div class="actions">
      <a href="${escapeHtml(playStoreUrl)}" class="btn btn-primary" id="playStoreBtn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.609 1.814L13.793 12 3.61 22.186a1.99 1.99 0 0 1-.61-.904V2.718c.15-.36.368-.677.61-.904zm11.602 11.602L4.832 23.795c.297.13.633.205.991.205.474 0 .914-.14 1.282-.38l10.932-6.26-2.826-3.944zm0-2.832l2.826-3.944-10.932-6.26c-.368-.24-.808-.38-1.282-.38-.358 0-.694.075-.991.205l10.379 10.379zm1.417 1.416l3.528 2.022c.983.563.983 1.485 0 2.048l-3.528 2.022-2.584-3.046 2.584-3.046z"/>
        </svg>
        Get on Google Play (Passes Code)
      </a>

      <a href="${escapeHtml(appStoreUrl)}" class="btn btn-secondary" id="appStoreBtn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.78 1.06-1.87.94-2.96-.92.04-2.02.61-2.67 1.39-.58.68-1.09 1.77-.95 2.83 1.03.08 2.06-.51 2.68-1.26z"/>
        </svg>
        Download on App Store
      </a>

      <a href="${escapeHtml(deepLink)}" class="btn btn-app" id="openAppBtn">
        Open in Slipstream App
      </a>
    </div>

    <footer>
      Slipstream Motorsport Telemetry &middot; Invitation code saved
    </footer>
  </div>

  <script>
    function copyCode() {
      const code = ${JSON.stringify(cleanCode || 'SLIPSTREAM')};
      navigator.clipboard.writeText(code).then(() => {
        alert('Invite code ' + code + ' copied to clipboard!');
      });
    }

    // Save cookie on client side too for web attribution persistence
    try {
      const code = ${JSON.stringify(cleanCode)};
      if (code) {
        document.cookie = "slipstream_invite_code=" + code + "; path=/; max-age=2592000; SameSite=Lax; Secure";
      }
    } catch (e) {}

    // Auto-launch deep link on mobile browsers
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      setTimeout(() => {
        window.location.href = ${JSON.stringify(deepLink)};
      }, 400);
    }
  </script>
</body>
</html>`;

  res.send(html);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
