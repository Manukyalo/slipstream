# Slipstream EAS Updates & Deployment Guide

This document defines how Slipstream updates are shipped, diagnosed, and verified across native releases and Over-The-Air (OTA) iterations.

---

## 1. The Core Rule of Thumb

| Change Type | Mechanism | Needs New Native Build? |
| :--- | :--- | :--- |
| **JS / UI / Screens / CSS / Images** | `eas update` | **NO** — Ships instantly Over-the-Air |
| **App Logic / Hooks / Services / Fixes** | `eas update` | **NO** — Ships instantly Over-the-Air |
| **New Native Modules / SDK Upgrade** | `eas build` | **YES** — New APK / AAB required |
| **Native Config (`app.json` permissions, plugins)** | `eas build` | **YES** — New APK / AAB required |

---

## 2. Channels & Profile Architecture

Slipstream maintains three explicit EAS channels mapped 1-to-1 to EAS branches:

```
Git / Updates Branch          EAS Channel            EAS Build Profile
─────────────────────────────────────────────────────────────────────────────
development           ───►   development    ───►   development (Dev-Client APK)
preview               ───►   preview        ───►   preview (Standalone Internal APK)
production            ───►   production     ───►   production (Google Play / App Store)
```

> **Important**: Standalone test builds on user devices run on the **`preview`** channel. When releasing an OTA update for internal testing, always target `--branch preview`.

---

## 3. Shipping an Over-The-Air Update

To publish JavaScript or UI changes to your testers without rebuilding native code:

```bash
# Preview Channel (Internal APK Testers)
npx eas-cli update --branch preview --environment preview --message "feat: description of change" --non-interactive

# Development Channel (Dev-Client)
npx eas-cli update --branch development --environment development --message "feat: description of change" --non-interactive
```

### How the App Applies Updates
1. **At Cold Launch**: `expo-updates` checks for updates on start (`checkAutomatically: "ON_LOAD"`).
2. **In Foreground**: Slipstream's `useOtaUpdates()` hook checks every time the app is brought to the foreground (`AppState === 'active'`), throttled to once every 5 minutes.
3. **Pit-Wall Notification**: When a new bundle is downloaded, a non-blocking banner appears at the top:
   > **Update Ready** · *New telemetry updates are downloaded [Restart]*
   Tapping **Restart** reloads the app into the new update immediately.

---

## 4. On-Device Diagnostics Panel

To confirm which update your device is running:
1. Open the app and navigate to **Settings** (gear icon).
2. Scroll to the very bottom to the app version string: `Slipstream v1.0.0 (Build 1)`.
3. **Long-press and hold** the text for 600ms.
4. The **EAS Update Diagnostics** panel expands, showing:
   - **Channel**: e.g., `preview`
   - **Runtime**: e.g., `1.0.0`
   - **Update ID**: Specific UUID of the active OTA bundle (or `Embedded` if running the initial binary bundle)
   - **Embedded launch**: `Yes` / `No`
   - **Updates enabled**: `Yes`
   - **Last status**: `up-to-date`, `downloading`, `ready`, or `error` with timestamp
   - **Check now**: Button to immediately force an OTA check bypassing throttle.

---

## 5. Verification Protocol

To verify that updates are arriving properly:
1. Run `npx eas-cli update --branch preview --environment preview --message "ota verification test" --non-interactive`.
2. Open the app on the phone.
3. Confirm the pit-wall banner pops up or check the diagnostics panel in Settings.
4. Verify the `Update ID` in diagnostics matches the new update ID printed by EAS.
