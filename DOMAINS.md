# Slipstream Domain & Deep Link Runbook

This guide covers domain registration, Vercel DNS configuration, Universal/App Links verification, and environment variable management for Slipstream.

---

## 1. Domain Registration

For production app store listing, merchant verification (e.g., IntaSend), and brand trust on WhatsApp/social invites:

1. **Purchase a domain** matching the Slipstream brand (e.g., `slipstream.app`, `slipstreamapp.com`, `slipstreamtelemetry.com`) on registrars such as Cloudflare, Namecheap, or Porkbun.
2. Note: IntaSend and App Store review require your own root domain, not a free `.vercel.app` subdomain.

---

## 2. Connect Domain in Vercel

1. Log into [Vercel Dashboard](https://vercel.com) and navigate to your **Slipstream** project.
2. Go to **Settings** &rarr; **Domains**.
3. Add your custom domain (e.g., `slipstream.app` and `www.slipstream.app`).
4. Select **Redirect `www.slipstream.app` to `slipstream.app`** (or vice versa according to your preference).

---

## 3. Configure DNS Records

In your DNS registrar or DNS management portal (Cloudflare, Namecheap, Route53, etc.), configure the following records:

| Type | Name / Host | Target / Value | TTL | Note |
|---|---|---|---|---|
| **A** | `@` (root) | `76.76.21.21` | Automatic / 300s | Points apex domain to Vercel global edge network |
| **CNAME** | `www` | `cname.vercel-dns.com` | Automatic / 300s | Points www subdomain to Vercel |

> [!NOTE]
> If your DNS provider is **Cloudflare**, set the proxy status for both records to **DNS Only** (Gray Cloud) during initial verification and SSL certificate issuance by Vercel.

---

## 4. Verify DNS Propagation

Run `dig` in your terminal to verify that the DNS records resolve globally:

```bash
# Verify Apex A record
dig @8.8.8.8 slipstream.app A +short
# Expected output: 76.76.21.21

# Verify CNAME record
dig @8.8.8.8 www.slipstream.app CNAME +short
# Expected output: cname.vercel-dns.com.
```

On Windows PowerShell:
```powershell
Resolve-DnsName -Name slipstream.app -Type A
Resolve-DnsName -Name www.slipstream.app -Type CNAME
```

Once DNS is verified, Vercel will automatically provision a free Let's Encrypt SSL certificate.

---

## 5. Update Base URL Environment Variables

Once your custom domain is live, updating links across the web landing page and mobile share sheets requires **only an environment variable change**:

### Local `.env`:
```env
EXPO_PUBLIC_APP_URL=https://slipstream.app
NEXT_PUBLIC_APP_URL=https://slipstream.app
```

### EAS Cloud Build Profiles (`eas.json`):
Update `EXPO_PUBLIC_APP_URL` in `development`, `preview`, and `production`:
```json
"env": {
  "EXPO_PUBLIC_APP_URL": "https://slipstream.app"
}
```

### Vercel Project Settings:
1. In Vercel Project &rarr; **Settings** &rarr; **Environment Variables**.
2. Add / Update:
   - `NEXT_PUBLIC_APP_URL` = `https://slipstream.app`
   - `EXPO_PUBLIC_APP_URL` = `https://slipstream.app`

Vercel keeps your `.vercel.app` deployment URL alive even after attaching a custom domain, ensuring previously shared invite links never break.

---

## 6. Deep Links & Universal Links Verification

### Android App Links (`/.well-known/assetlinks.json`)
The file is served from [`public/.well-known/assetlinks.json`](file:///c:/Users/Manu/Desktop/slipstream/public/.well-known/assetlinks.json).

To verify in browser:
```bash
curl -I https://slipstream.app/.well-known/assetlinks.json
# Header must return: Content-Type: application/json (200 OK, no redirect)
```

To update release fingerprints when building with EAS:
1. Run `eas credentials` &rarr; Android &rarr; Keystore.
2. Copy the SHA-256 fingerprint into `public/.well-known/assetlinks.json`.
3. If using Google Play App Signing, copy the SHA-256 from Google Play Console &rarr; Setup &rarr; App Integrity.

### Apple Universal Links (`/.well-known/apple-app-site-association`)
The file is served without an extension from [`public/.well-known/apple-app-site-association`](file:///c:/Users/Manu/Desktop/slipstream/public/.well-known/apple-app-site-association).

To verify in browser:
```bash
curl -I https://slipstream.app/.well-known/apple-app-site-association
# Header must return: Content-Type: application/json (200 OK, no redirect)
```

Replace `TEAMID` in `public/.well-known/apple-app-site-association` with your Apple Developer Team ID (found in developer.apple.com &rarr; Membership details).

---

## 7. Acceptance Test Matrix

| Scenario | Action | Expected Result |
|---|---|---|
| **Social Card Preview** | Paste `https://slipstream.app/i/CODE` into WhatsApp or X | Renders rich preview with 1200x630 telemetry HUD image, title: "{Driver} invited you to Slipstream", description. |
| **Phone Without App** | Open link in mobile browser (Safari / Chrome) | Displays branded Slipstream landing page with inviter name, feature grid, and download buttons. Play Store button passes `referrer=invite_CODE`. Sets 30-day attribution cookie. |
| **Phone With App** | Tap link with Slipstream installed | Automatically activates Android App Link / iOS Universal Link &rarr; opens Slipstream directly into signup flow with code pre-filled. |
| **Invalid / Expired Code** | Open `https://slipstream.app/i/INVALID99` | Renders friendly landing page ("Join Slipstream Telemetry") with same download buttons. Never shows a 404. |
| **Attribution Idempotency** | Complete signup | Inviter is credited once via Supabase RPC `claim_referral_code`. Duplicate signups or self-referrals are rejected safely. |
