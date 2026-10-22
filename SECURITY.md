# Slipstream Security & Threat Model

This document outlines the security architecture, Android platform threat modeling, data protection mechanisms, and incident response procedures implemented across the Slipstream mobile application and Supabase backend.

---

## 1. Security Architecture Overview

Slipstream adopts a defense-in-depth model across device, network, database, and telemetry layers:

```
┌─────────────────────────────────────────────────────────────┐
│ Mobile Client (Android / iOS)                               │
│  - Biometric Gatekeeper (LocalAuthentication)               │
│  - Android KeyStore Encryption (SecureStore)                │
│  - Verified Android App Links (autoVerify)                  │
│  - Accelerometer & Doppler Sensor Sanity Checking           │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS (TLS 1.3) / WSS
┌──────────────────────────────▼──────────────────────────────┐
│ Supabase Edge & Database Layer                              │
│  - Row Level Security (RLS) on 100% of Public Tables         │
│  - Server-Side Route Privacy Trimming (300m start/end)      │
│  - Physical Plausibility Constraints (Anti-Cheat)           │
│  - 30-Day Coordinate Pruning (GDPR Data Minimisation)       │
│  - Cascading Right-to-be-Forgotten Wipe                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Implemented Security Features

### A. Device & Authentication Security
- **Biometric App Lock (`services/biometrics.ts`, `BiometricLockScreen.tsx`)**:
  - Optional hardware-backed biometric authentication (Fingerprint, Face Unlock, Biometric Prompt) with device passcode fallback.
  - Intercepts cold starts and foreground returns when enabled.
- **Hardware-Backed Secret Storage (`expo-secure-store`)**:
  - Session tokens and security flags are stored exclusively in Android KeyStore (AES-256 GCM) / iOS Keychain.
  - Zero sensitive tokens or credentials touch unencrypted `AsyncStorage` or `localStorage`.
- **Verified App Links (`app.json`)**:
  - `intentFilters` configured with `autoVerify: true` for `slipstream-app.vercel.app` and `slipstream.app`.
  - Android Digital Asset Links ensure malicious third-party apps cannot hijack Slipstream deep links.

### B. Telemetry & Location Privacy
- **Server-Side Route Privacy Trimming (`0015_route_privacy.sql`)**:
  - `sanitize_shared_route()` automatically clips the first and last 300 meters of public/shared routes to prevent residential addresses and garages from being exposed on leaderboards or shared cards.
  - User-configurable circular geofence privacy zones (`user_privacy_zones`).
- **Data Minimization & Pruning (`0009_security_and_compliance.sql`)**:
  - `purge_old_speed_samples()` strips raw high-frequency point coordinates older than 30 days while preserving aggregated trip metrics (distance, top speed, moving duration).
- **Explicit Location Consent (`LocationConsentModal.tsx`)**:
  - Explicit compliance modal before starting GPS telemetry, explaining continuous background use and storage policies.

### C. Backend & Database Security
- **Strict Row Level Security (RLS)**:
  - Every table (`trips`, `vehicles`, `drag_runs`, `hazards`, `profiles`, `user_rate_limits`) enforces RLS.
  - Authenticated users cannot mutate or read private telemetry of another driver.
- **Server-Side Anti-Cheat & Physical Plausibility (`0006_rankings_and_validation.sql`)**:
  - Top speed capped at physical thresholds ($\le 500\text{ km/h}$).
  - 1/4 mile drag runs strictly checked ($\ge 5.0\text{ s}$ for street vehicles).
  - Teleportation detection (rejects coordinate deltas $> 150\text{ m}$ within 1s).
- **GDPR / CCPA Account Deletion (`delete_user_account()`)**:
  - Atomic, cascading delete of driver credentials, telemetry, vehicle garage, leaderboard records, and media from Supabase Storage.

---

## 3. Android Threat Modeling & Attack Point Coverage

| Attack Vector | Status | Mitigation in Slipstream |
| :--- | :--- | :--- |
| **Insecure Data Storage** | **Covered** | Sensitive tokens in Android KeyStore (`expo-secure-store`). Offline queue in local SQLite with parameterized SQL. |
| **SQL / Injection Attacks** | **Covered** | Zero dynamic string-concatenated SQL queries. Parameterized queries in SQLite and Supabase PostgREST. |
| **Intent Spoofing / Link Hijacking** | **Covered** | Android App Links with `autoVerify: true` and SHA-256 digital asset fingerprints. |
| **Insecure Network Traffic** | **Covered** | TLS 1.3 HTTPS exclusively. Cleartext HTTP traffic is disabled. |
| **Broken Authorization / IDOR** | **Covered** | Supabase Postgres RLS validates `auth.uid() = user_id` at the database engine level. |
| **Data Scraping / Rate Abuse** | **Covered** | `user_rate_limits` table and RPC rate-limiting functions. |
| **Location Snooping / Stalking** | **Covered** | Server-side 300m start/finish privacy buffer and 30-day raw coordinate pruning. |
| **Root / Magisk / Frida Hooking** | **Partial** | Hardware biometrics use Android KeyStore. Advanced runtime root/hooking detection (Play Integrity API) is recommended for competitive tier leaderboards. |
| **Screen Overlay / Tapjacking** | **Advisory** | Recommend enabling `filterTouchesWhenObscured` in custom native build if banking/payment transactions are added. |
| **ADB Backup Extraction** | **Recommendation** | Ensure `allowBackup: false` is configured in `app.json` for hardened production release. |

---

## 4. Safety & Incident Response (Breach Contingency)

In the event of an authentication compromise, API credential leak, or security incident, the following mitigation controls are active:

1. **Instant Session Invalidation**:
   - Supabase Auth supports global session revocation via Admin API:
     ```ts
     await supabase.auth.admin.signOut(userId, 'global');
     ```
   - Immediately revokes all active JWT tokens and refresh tokens on mobile devices.
2. **RLS Blast-Radius Isolation**:
   - If a single user account is breached, Row Level Security prevents the attacker from reading or modifying any other user's garage, private drives, or account details.
3. **Emergency Account Purge**:
   - Users or administrators can invoke `delete_user_account()`, triggering an irreversible cascading wipe of all associated records.
4. **Emergency Over-The-Air (OTA) Patching via EAS Update**:
   - If an insecure endpoint, client-side leak, or vulnerable dependency is discovered, the fix can be deployed over-the-air in minutes via `eas update`, reaching all active Android and iOS devices without waiting for app store reviews.
5. **Database Emergency Lockdown**:
   - RLS policies can be switched to `USING (false)` via migration or Supabase dashboard in seconds to freeze write or read operations during incident investigation.

---

## 5. Vulnerability Disclosure

If you discover a security vulnerability in Slipstream, please report it privately:
- **Email**: `security@slipstream.app`
- Do not disclose vulnerabilities publicly until an investigation and patch have been released.
