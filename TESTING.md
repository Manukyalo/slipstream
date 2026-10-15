# Slipstream Release QA & Test Plan (Phase 11)

This document provides the definitive verification matrix, regression testing protocols, battery/thermal profiling instructions, store assets, and release triage for the Slipstream mobile application on Expo SDK 57 / React Native 0.86.

---

## 1. Automated Verification Suite

Run all automated checks prior to any release or OTA deployment:

```bash
# 1. Strict TypeScript Compile Check (Zero errors required)
npx tsc --noEmit

# 2. Strict ESLint Verification (Zero warnings, zero errors required)
npx expo lint

# 3. Unit Test Suite (Node.js native test runner)
npm test
```

### Automated Suite Baseline Status

| Suite | Status | Duration | Coverage |
| :--- | :--- | :--- | :--- |
| **TypeScript Strict** | PASS (0 errors) | ~14s | Full codebase strict compile |
| **ESLint (`eslint-config-expo`)** | PASS (0 errors, 0 warnings) | ~9s | React 19 rules, unused vars, imports |
| **Drag Sensor Fusion** | PASS (4 tests) | ~13ms | Zero-offset bias, launch surge, bump noise rejection, course projection |
| **Lap Timing & Geofencing** | PASS (7 tests) | ~11ms | Haversine distance, heading wrap, circular gate proximity, segment intersection interpolation, heading filters, lap delta, lap formatting |
| **Telemetry & GPS Math** | PASS (5 tests) | ~6ms | Speed unit conversions, GPS jump anomaly rejection (>150m/s), speed distribution buckets, WKT LINESTRING |

---

## 2. Device & Network Verification Matrix (Manual Checklist)

### 2.1 Form Factor & Display Matrix

| Device Class | Reference Target | Test Focus | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **Small Android (360 dp width)** | Pixel 4a / Samsung Galaxy A12 (360x800) | ScreenContainer padding, stat card font autoscaling, Christmas tree staging layout without vertical overflow, modal action button stacking | [ ] |
| **Large Android (412+ dp width)** | Pixel 9 Pro / Galaxy S24 Ultra (412x915) | Grid alignment in Garage and Rankings, two-column recap layouts, map fullscreen aspect ratio | [ ] |
| **iOS Notch Device** | iPhone 14 / iPhone 13 (390x844) | Status bar inset padding, notch clearance on modal sheets, bottom tab bar clearance | [ ] |
| **iOS Dynamic Island** | iPhone 15 Pro / 16 (393x852) | Dynamic island top inset clearance during live drive, background location pill behavior | [ ] |
| **Punch-hole Android Cameras** | Center and corner punch-holes | Safe area insets in horizontal and portrait telemetry screens | [ ] |
| **Android 3-Button Navigation** | System back, home, recents bar enabled | Bottom button clearance in modal flows (Define Circuit, Add Vehicle, Biometric Lock) | [ ] |
| **Android Gesture Navigation** | Full-screen gesture bar | Edge-swipe gestures vs MapLibre drag gestures; bottom sheet pull handle clearance | [ ] |
| **System Theme Toggle** | Dark & Light system preferences | UI strictly maintains high-contrast telemetry palette (`#05070D` background, `#0E131B` surface) regardless of OS light mode setting | [ ] |

### 2.2 Network & Resilience Matrix

| Network Condition | Simulation Method | Expected Behavior | Pass / Fail |
| :--- | :--- | :--- | :--- |
| **Airplane Mode (Offline)** | Toggle OS Airplane Mode while navigating | `OfflineSyncBanner` appears at top; cached trips and vehicles remain readable from TanStack Query persist cache; new drag run or trip enqueues to SQLite offline queue | [ ] |
| **Network Reconnection** | Disable Airplane Mode | `OfflineSyncBanner` changes to syncing state and auto-dismisses; queued runs upload to Supabase | [ ] |
| **High Latency / Throttled 3G** | Network link conditioner (150kbps, 1500ms RTT) | Skeletons shimmer smoothly (1.2s shimmer loop); no double-submits on buttons; optimistic UI updates for favorites and vehicle switch | [ ] |
| **Supabase Service Outage (500/503)** | Block Supabase domain or simulate mock outage | `ErrorState` card renders with user-friendly error message (`toUserMessage()`); raw stack traces suppressed; `Retry` button re-executes query | [ ] |
| **Session Expired / Token Revoked** | Manually invalidate refresh token in storage | User is cleanly redirected to `/(auth)/sign-in`; in-flight requests abort without unhandled promise rejections; no modal locks | [ ] |

---

## 3. Regression Test Protocols (9 Core User Flows)

### Flow 1: Authentication & Onboarding
1. Launch app on fresh install or clear data.
2. Verify onboarding screens render with Space Grotesk headers and feature highlights.
3. Tap "Sign in with Apple" (iOS) -> complete FaceID -> verify profile auto-initializes.
4. Sign out -> test "Sign in with Google" -> verify token exchange and redirect to garage.
5. Sign out -> test email magic link / password sign-in with valid and invalid credentials.
6. Verify biometric lock prompt displays on cold launch if enabled in Settings.

### Flow 2: Live Drive Recording
1. Navigate to Live Drive tab (`/track`).
2. Grant foreground and background location permissions.
3. Tap "Start Tracking". Verify GPS accuracy status chip and speedometer responsiveness.
4. Drive or simulate motion: confirm real-time polyline draws on MapLibre map.
5. Tap "End Drive". Verify trip summary modal opens showing distance, duration, top speed, and speed distribution buckets.
6. Tap "Save". Verify trip saves to Supabase and appears at top of Recap screen.

### Flow 3: Drag Race Telemetry
1. Navigate to Drag Race tab (`/(tabs)/drag-race`).
2. Select target mode chip (e.g., `¼ mi` or `0–60`).
3. Tap "Stage Vehicle". Confirm phone initiates zero-offset sensor calibration for 20 samples (~0.8s).
4. Verify Christmas Tree activates countdown (amber lights step every 500ms).
5. Green light triggers -> accelerate past launch threshold (>0.25 G or >5 km/h).
6. Verify live timer ticks, G-force meter peaks, and 60-ft split registers.
7. Cross finish line: verify run finishes, trap speed and elapsed time display, and PB badge appears if new record.
8. False start test: move vehicle during amber countdown -> verify tree illuminates red foul light and run is recorded as foul.

### Flow 4: Custom Circuit Definition & Lap Timing
1. Navigate to Track Day tab (`/(tabs)/track-day`).
2. Tap "Define Track" -> enter track name and location.
3. Walk or drive across desired start/finish line -> tap "Set Start/Finish Gate" (records coordinates and heading).
4. Optional: add intermediate sector gate points. Save track.
5. Tap "Start Session" on created track.
6. Complete an out-lap and cross gate: verify Lap 1 begins.
7. Complete Lap 1: verify gate line-crossing interpolation computes exact millisecond lap time and delta vs PB.
8. Finish session: confirm lap history persists to database with sector splits.

### Flow 5: Global Rankings & Leaderboards
1. Navigate to Rankings tab (`/(tabs)/rankings`).
2. Verify segmented control switches between: Global Drivers, 1/4 Mile Drag, and Circuit Laps.
3. Verify vehicle classification filters (Stock, Tuned, Supercar).
4. Verify user rank pin is visible at the bottom if user is outside top 10.
5. Pull-to-refresh: confirm query revalidates and list updates without jank.

### Flow 6: Social Recap & Story Card Export
1. Navigate to Recap tab (`/(tabs)/recap`).
2. Select any recorded trip or drag run.
3. Tap "Share Story Card".
4. Verify custom telemetry card renders with dark glassmorphism, route mini-map, vehicle specs, and watermark.
5. Tap "Share" -> verify native iOS/Android system share sheet opens with generated PNG.

### Flow 7: Garage & Vehicle Management
1. Navigate to Profile / Garage screen.
2. Tap "Add Vehicle" -> select or enter Make, Model, Year, Power (HP), and Drive Type (AWD/RWD/FWD).
3. Set vehicle as "Primary".
4. Verify primary vehicle badge updates across all telemetry tabs.
5. Upload vehicle photo via image picker -> confirm image manipulation compresses photo and uploads.

### Flow 8: Offline Telemetry Synchronization
1. Enable Airplane Mode.
2. Record a drag run or trip.
3. Verify session saves locally with client ID and displays pending sync badge.
4. Re-enable Internet connection -> observe offline queue drain.
5. Verify record transitions from pending to synced in Supabase.

### Flow 9: Account Deletion (GDPR & Store Compliance)
1. Navigate to Settings -> Privacy & Security.
2. Tap "Delete Account" -> verify confirmation modal with irreversible warning.
3. Confirm deletion -> verify user record, trips, drag runs, and garage vehicles cascade delete from Supabase.
4. Verify local AsyncStorage, secure tokens, and TanStack cache are completely wiped.
5. User is redirected to welcome screen.

---

## 4. Battery & Thermal Test Protocol (30-Minute Screen-Off Drive)

### Purpose
Validate that background location telemetry, foreground service, and SQLite buffering execute without excessive battery drain, OS task termination, or thermal throttling.

### Test Equipment & Setup
- Device: Physical device running Android 14+ or iOS 17+.
- Battery Level: Start at 80% charge (unplugged from USB/charger).
- Screen State: Screen turned OFF immediately after starting drive session.
- Duration: Exactly 30 minutes of continuous driving or simulated GPS route.

### Execution Steps
1. Open Slipstream and ensure version is verified via Settings diagnostics.
2. Start a drive session on Live Drive.
3. Ensure notification tray displays persistent foreground notification: `Slipstream · Telemetry Active`.
4. Press power button to turn device screen OFF.
5. Drive for 30 minutes over variable speed routes.
6. At 30:00, turn screen on, unlock device, and tap "End Drive".

### Pass / Fail Criteria
- **Battery Consumption**: Drain must not exceed 4.5% over 30 minutes on a healthy battery (~9% per hour).
- **Thermal Footprint**: Device temperature must not exceed 41°C (no OS thermal warning or frame drops upon wake).
- **Sample Integrity**: No gap in GPS samples greater than 3.0 seconds (confirms OS did not sleep foreground service).
- **State Recovery**: App resumes immediately on screen unlock without reloading or resetting tracking state.

---

## 5. Store Assets Package

### 5.1 App Store & Google Play Listing Copy

#### App Title
`Slipstream: Drive & Track GPS`

#### Subtitle (iOS - 30 chars max)
`Telemetry, Drag & Lap Timer`

#### Short Description (Android - 80 chars max)
`High-precision GPS telemetry, drag race timer, and circuit lap analytics.`

#### Promotional Text (170 chars max)
`Engineered for driving enthusiasts. Track quarter-mile drag runs, record circuit lap times with microsecond precision, and visualize full vehicle telemetry.`

#### Full Description
```
Slipstream is the definitive high-performance telemetry and timing companion for automotive enthusiasts, track day drivers, and performance tuners.

Turn your smartphone into a professional-grade telemetry logger. Slipstream fuses internal MEMS accelerometer sensors with high-frequency GPS positioning to deliver precision timing without expensive external hardware.

CORE FEATURES:

PRECISION DRAG TIMING
- Stage your vehicle with automated zero-offset sensor calibration.
- Sportsman Christmas Tree light countdown with false-start (foul) detection.
- Accurate splits: 60-foot, 330-foot, 1/8 mile, 1/4 mile, 1/2 mile, and 1 mile.
- 0–60 mph and 0–100 km/h acceleration sprint timers.
- Instant trap speed and peak G-force reporting.

CIRCUIT & TRACK DAY ANALYTICS
- Define custom track circuits anywhere with GPS start/finish and sector gates.
- Millisecond-precision lap timing with trajectory line-crossing interpolation.
- Real-time live lap delta (+/- vs personal best lap).
- Sector splits and multi-lap session comparisons.

TELEMETRY & DRIVE LOGGING
- Background drive recording with full route mapping and speed distribution analytics.
- Real-time speed and heading readouts.
- Automatic offline queueing ensures no telemetry is lost even without cellular coverage.

DIGITAL GARAGE & LEADERBOARDS
- Manage your fleet with custom vehicle specs, dyno power ratings, and maintenance logs.
- Compare benchmark times on global and circuit leaderboards.
- Filter rankings by vehicle class and drivetrain (AWD, RWD, FWD).

PRIVACY & DATA OWNERSHIP
- Your driving data belongs to you. Zero telemetry sold to third parties or insurance providers.
- Full offline capability with encrypted on-device storage.
```

#### Keywords (iOS - 100 chars max)
`telemetry,lap timer,drag race,0-60 timer,dragy,track day,speedometer,gps logger,car performance,motorsport`

---

### 5.2 Release Notes (What's New in Version 1.0.0)

```
What's New in Slipstream 1.0.0:

- Premium Design System: Complete visual overhaul featuring dark-room cockpit aesthetics, Space Grotesk typography, and fluid micro-animations.
- Sensor Fusion Engine: Staging zero-offset calibration for accelerometer readings with vibration filtering and peak G tracking.
- Track Day Circuit Builder: Define custom racing circuits with geometric gate crossing interpolation and live lap delta calculations.
- Drag Race Hub: Added 60-foot splits, sportsman tree countdowns, foul detection, and 0-60 / 0-100 sprint benchmarks.
- Enhanced Offline Resilience: SQLite local queue automatically buffers drives and telemetry when driving out of cellular coverage.
- Biometric Security: Optional Face ID / fingerprint protection on app launch.
- Dynamic Story Cards: Generate high-resolution telemetry recap cards to export directly to your favorite platforms.
```

---

### 5.3 Store Screenshot Specifications

| Screenshot | Target Screen | Hero Headline | Visual Emphasis |
| :--- | :--- | :--- | :--- |
| **01** | Drag Race (`/drag-race`) | `PRECISION DRAG TIMING` | Christmas Tree staged, 1/4 mile 10.82s, 131.4 mph trap speed, peak 1.15 G |
| **02** | Circuit Lap (`/track-day`) | `TRACK DAY LAP ANALYTICS` | Live circuit map, sector split chips, live delta `-0.412s` in bright green |
| **03** | Live Drive (`/track`) | `COCKPIT TELEMETRY` | Fullscreen dark vector map, circular speedometer at 118 km/h, telemetry HUD |
| **04** | Recap (`/recap`) | `DETAILED SESSION LOGS` | Reverse chronological trip cards, speed distribution charts, elevation profile |
| **05** | Story Card Modal | `SHAREABLE RECAP CARDS` | Glassmorphism story card with route vector, vehicle silhouette, and stats |
| **06** | Garage (`/profile`) | `YOUR DIGITAL FLEET` | Vehicle carousel, dyno horsepower, maintenance logs, and personal best medals |

---

## 6. Pre-Build Issue Triage

The following catalog lists all open issues and items classified by severity prior to production EAS builds:

| ID | Area | Severity | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ISS-01** | Map Engine | **Resolved** | Map engine & tile provider configuration | **RESOLVED** — Migrated to MapLibre GL JS with OpenFreeMap Dark tiles; no proprietary key blocker |
| **ISS-02** | TypeCheck | **Resolved** | Strict TypeScript verification | **RESOLVED** (`npx tsc --noEmit` exits code 0) |
| **ISS-03** | Lint | **Resolved** | ESLint & React 19 hook verification | **RESOLVED** (`npx expo lint` exits code 0) |
| **ISS-04** | Dep | **P3 (Low)** | `lucide-react-native` in `package.json` | Non-breaking; legacy package can be pruned in next dependency clean cycle |
| **ISS-06** | Fonts Plugin | **Resolved** | Font weight directory paths in `expo-font` | **RESOLVED** — Fixed subdirectory weights in `app.json` |
| **ISS-07** | Store Compliance | **Resolved** | Missing `ITSAppUsesNonExemptEncryption` in iOS Info.plist | **RESOLVED** — Configured `false` in `app.json` |

---

## 7. Production EAS Build & Deployment Instructions

### Active Production Builds

| Platform | Profile | Build ID | EAS Dashboard URL | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Android (AAB)** | `production` | `125e69aa-988a-4b33-bf25-8221206ac284` | [View Android Build](https://expo.dev/accounts/manukyalo/projects/slipstream/builds/125e69aa-988a-4b33-bf25-8221206ac284) | Building on EAS |
| **iOS (IPA)** | `production` | Pending Credentials | Run `npx eas-cli credentials` to link Apple Dev account | Pending |

### Cloud EAS Build Commands

```bash
# Build Android App Bundle (AAB for Google Play Store)
npx eas-cli build --platform android --profile production

# Set up iOS credentials (interactive Apple ID / 2FA login)
npx eas-cli credentials -p ios

# Build iOS Archive (IPA for Apple App Store / TestFlight)
npx eas-cli build --platform ios --profile production
```

### Over-The-Air (OTA) Release Command

For post-release JS/UI patches:

```bash
npx eas-cli update --branch production --message "v1.0.1 hotfix"
```
