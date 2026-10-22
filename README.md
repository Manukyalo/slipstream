<div align="center">

  <img src="assets/icon.png" alt="Slipstream Logo" width="96" height="96" style="border-radius: 20px; margin-bottom: 12px;" />

  # Slipstream

  **High-precision automotive telemetry, circuit lap timing, drag strip performance analyzer, and driver intelligence suite.**

  [![Expo SDK](https://img.shields.io/badge/Expo-SDK%2057-000000?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
  [![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict%206.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
  [![Supabase](https://img.shields.io/badge/Backend-Supabase%20Postgres-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
  [![License: MIT](https://img.shields.io/badge/License-MIT-F5A623?style=for-the-badge)](LICENSE)

</div>

---

## ⚡ Overview

**Slipstream** turns your smartphone into a professional-grade telemetry logger and performance computer. Engineered for track day drivers, drag racers, and automotive enthusiasts, it fuses continuous high-frequency GPS Doppler signals, 3-axis accelerometer dynamics, and low-latency gate-crossing interpolation into an ultra-responsive, dark-mode cockpit HUD.

Every trip, drag run, and circuit split is recorded locally with offline-first reliability, verified against server-side anti-cheat heuristics, and protected with enterprise-grade privacy boundaries.

---

## 🏎️ Core Capabilities

### 1. Live Telemetry Cockpit (`/track`)
- **Doppler GPS & Deadband Clamping**: Clean real-time speed readout (mph / km/h) filtered to eliminate stationary drift and GPS jumps ($> 150\text{ m/s}$).
- **Dynamic G-Force HUD**: Lateral and longitudinal acceleration telemetry via sensor fusion.
- **Continuous Background Logging**: Uninterrupted trip recording powered by persistent foreground services and Android notification channels.

### 2. Drag Strip & Launch Staging (`/drag-race`)
- **NHRA-Style Christmas Tree**: Visual and haptic staging sequence (Pre-Stage, Stage, Amber drop, Green light).
- **Zero-Offset Accelerometer Fusion**: Automatic bias calibration and instant launch surge detection.
- **Standard Acceleration Splits**: Precise timing for `0-60 mph`, `0-100 km/h`, `1/8 mile`, `1/4 mile`, and `60-130 mph` with trap speeds and reaction time calculation.
- **Server-Side Anti-Cheat**: Physical plausibility constraints enforced via database rules before runs enter public leaderboards.

### 3. Circuit & Track Day Timing (`/track-day`)
- **Custom Circuit Builder**: Interactive gate mapping for custom track lines and sector splits.
- **Sub-Tick Boundary Interpolation**: High-speed vector projection across finish gates to eliminate GPS sampling latency.
- **Pace Delta HUD**: Real-time delta comparison against session-best laps with sector-by-sector delta analysis.

### 4. Radar & Hazard Intelligence (`/roads`)
- **Crowdsourced Hazard Radar**: Real-time alerts for speed cameras, mobile traps, road debris, and track closures.
- **Proximity Cooldown Engine**: Directional proximity calculations with audio-haptic warnings and nuisance dampening.
- **Curated Driving Routes**: Discover, rate, and save driving roads with elevation profiles and WKT line geometries.

### 5. Digital Garage & Maintenance Ledger (`/profile`)
- **Vehicle Fleet Management**: Track multiple vehicles with curated catalog specs (power, weight, drivetrain, aspiration).
- **Service & Odometer Reminders**: Mileage-based service alerts (fluids, brakes, tires, spark plugs) tied to live GPS tracking.
- **Vehicle-Aware Metrics**: Filter and associate drag runs and track telemetry to specific car setups.

### 6. Privacy & Security Shield (`SECURITY.md`)
- **Automated Route Trimming**: Strips the first and last 300 meters of public/shared routes to protect home and garage locations.
- **Circular Privacy Geofences**: User-defined exclusion zones that conceal telemetry within custom radii.
- **Hardware Biometric Lock**: Optional fingerprint/face unlock via `expo-local-authentication` and Android KeyStore.
- **100% Row Level Security**: Strict database isolation on Supabase ensuring zero unauthorized telemetry access.

---

## 📁 Repository Structure

```
slipstream/
├── .well-known/           # Android Digital Asset Links & Apple App Site Association
├── api/                   # Vercel serverless functions & deep-link redirects
├── app/                   # Web deep link redirect handlers
├── assets/                # App icons, splash screens, and brand imagery
├── components/            # Domain-driven modular React Native components
│   ├── circuit/           # Gate definitions, lap timers, sector splits
│   ├── drag/              # Christmas tree staging, time slip cards
│   ├── garage/            # Vehicle cards, spec chips, maintenance logs
│   ├── hazards/           # Radar zone cards, hazard submission sheets
│   ├── map/               # High-contrast MapLibre HUD & vector lines
│   ├── security/          # Biometric lock screen, privacy zone managers
│   ├── tracking/          # Live speedometer, drive controls, GPS status
│   └── ui/                # Base design system (GlassCard, Button, Badge)
├── constants/             # Design tokens, color palette, typography scales
├── contexts/              # Global React contexts (Auth, Vehicles, Location)
├── hooks/                 # Custom React hooks (telemetry, updates, offline queue)
├── services/              # External APIs, biometrics, SQLite queue, Supabase client
├── src/app/               # Expo Router screens
│   ├── (auth)/            # Sign-in, sign-up, password recovery
│   ├── (tabs)/            # Main cockpit tabs (Track, Drag, Circuit, Roads, Garage)
│   └── _layout.tsx        # Root navigator with biometric & OTA gates
├── supabase/              # Database migrations, seed data, and Edge Functions
│   ├── functions/         # Deno Edge Functions (account wipe, recap cards, hazards)
│   └── migrations/        # Versioned SQL migrations with RLS policies
├── AGENTS.md              # Engineering rules & AI collaboration guide
├── DOMAINS.md             # Custom domain DNS, Vercel & App Link verification
├── SECURITY.md            # Threat model, data privacy, and encryption specifications
├── TESTING.md             # QA test matrix, thermal profiling, and regression checklist
└── UPDATES.md             # EAS Over-The-Air (OTA) updates & branch matrix
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.x` or later (LTS recommended)
- **Package Manager**: `npm`
- **Expo CLI**: Installed via `npx expo`
- **Physical Device or Emulator**:
  - Android Device / Emulator with Google Play Services (recommended for GPS & accelerometer testing)
  - iOS Device / Simulator (macOS required for iOS builds)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Manukyalo/slipstream.git
cd slipstream
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Application Base URL
EXPO_PUBLIC_APP_URL=https://slipstream.app
```

### 3. Run Development Server

```bash
# Start Metro bundler
npx expo start

# Run directly on Android
npx expo run:android

# Run directly on iOS
npx expo run:ios
```

> **Note**: For native sensors (Doppler GPS, hardware accelerometer, Biometric authentication), testing on a physical device using an **EAS Development Build** (`npx expo run:android` or `eas build --profile development`) delivers true hardware fidelity.

---

## 🧪 Testing & Verification

Every pull request and build must pass the full verification matrix:

```bash
# 1. Strict TypeScript Compile Check (Zero errors)
npx tsc --noEmit

# 2. Strict Lint Verification
npx expo lint

# 3. Unit Test Suite (Sensor fusion & lap timing math)
npm test
```

For device testing matrices, thermal profiling, and offline sync verification steps, refer to [TESTING.md](TESTING.md).

---

## 📲 Deployment & Over-The-Air (OTA) Updates

Slipstream uses **EAS Updates** to deliver instant bug fixes and telemetry updates directly to devices without requiring App Store or Google Play re-review.

```bash
# Publish OTA update to internal preview testers
npx eas-cli update --branch preview --message "fix: GPS accuracy and staging haptics"

# Publish OTA update to production
npx eas-cli update --branch production --message "feat: live delta lap splits"
```

Refer to [UPDATES.md](UPDATES.md) for full branch mappings and the on-device diagnostics runbook.

---

## 🔒 Security & Privacy

Automotive telemetry data is sensitive. Slipstream implements defense-in-depth principles:
- **Zero Raw Coordinates on Public Feeds**: Route starts and ends are automatically clipped by 300 meters.
- **End-to-End KeyStore Storage**: Tokens and biometrics stay encrypted on the physical device.
- **Cascading Right-to-be-Forgotten**: Instant and irreversible account data wiping via dedicated Edge Function.

For vulnerability reports and our full threat model, see [SECURITY.md](SECURITY.md).

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
