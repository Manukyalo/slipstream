/**
 * toUserMessage — error → friendly copy mapper
 *
 * RULE: This is the ONLY place that inspects raw error objects.
 *       Call this before passing any error message to the UI.
 *       The raw error is logged to Sentry here and never surfaces to the user.
 *
 * Usage:
 *   const message = toUserMessage(error);
 *   return <ErrorState message={message} onRetry={refetch} />;
 */

// Sentry is wired via the native build (sentry-wizard). Until then, safe-import.
// After running the wizard and triggering a build, this will capture errors automatically.
let Sentry: { captureException?: (e: unknown) => void } = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require('@sentry/react-native');
} catch {
  // @sentry/react-native not yet installed — logging to console in dev only
}

// ─────────────────────────────────────────────────────────────────────────────
// Error classification
// ─────────────────────────────────────────────────────────────────────────────

/** True when the device has no route to the internet or host cannot be resolved */
function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    if (typeof error === 'string') {
      const str = error.toLowerCase();
      return (
        str.includes('unknownhostexception') ||
        str.includes('unable to resolve host') ||
        str.includes('no address associated') ||
        str.includes('network') ||
        str.includes('failed to fetch')
      );
    }
    return false;
  }
  const msg = error.message.toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('unknownhostexception') ||
    msg.includes('unable to resolve host') ||
    msg.includes('no address associated') ||
    msg.includes('connection refused') ||
    msg.includes('offline')
  );
}

/** True when the server returned a 4xx or 5xx status */
function isHttpError(error: unknown): boolean {
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status: number }).status;
    return status >= 400;
  }
  return false;
}

function getHttpStatus(error: unknown): number | null {
  if (error instanceof Error && 'status' in error) {
    return (error as Error & { status: number }).status ?? null;
  }
  return null;
}

/** Supabase errors carry a `code` field */
function getSupabaseCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as Record<string, unknown>).code);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────────────────────────────────────

export function toUserMessage(error: unknown): string {
  // Log raw error to Sentry — user never sees this
  try {
    Sentry.captureException?.(error);
  } catch {
    // Sentry not yet initialized (e.g., dev build). Fail silently.
    if (__DEV__) {
      console.error('[toUserMessage] Raw error:', error);
    }
  }

  // ── Network ──────────────────────────────────────────────────────────────
  if (isNetworkError(error)) {
    return "Can't reach Slipstream servers. Check your connection.";
  }

  // ── HTTP status-based ────────────────────────────────────────────────────
  if (isHttpError(error)) {
    const status = getHttpStatus(error);

    if (status === 401) return 'Your session has expired. Please sign in again.';
    if (status === 403) return "You don't have permission to do that.";
    if (status === 404) return 'That content could not be found.';
    if (status === 409) return 'A conflict occurred. Please refresh and try again.';
    if (status === 422) return 'Some information was invalid. Check your input and try again.';
    if (status === 429) return 'Too many requests. Wait a moment and try again.';
    if (status != null && status >= 500) {
      return 'Something went wrong on our end. Try again in a moment.';
    }
  }

  // ── Supabase-specific codes ───────────────────────────────────────────────
  const sbCode = getSupabaseCode(error);
  if (sbCode) {
    if (sbCode === 'PGRST301' || sbCode === '42501') {
      return "You don't have permission to do that.";
    }
    if (sbCode === '23505') {
      return 'This record already exists.';
    }
    if (sbCode === 'invalid_credentials') {
      return 'Incorrect email or password.';
    }
    if (sbCode === 'email_not_confirmed') {
      return 'Check your email and confirm your account first.';
    }
    if (sbCode === 'user_already_exists') {
      return 'An account with this email already exists.';
    }
    if (sbCode === 'otp_expired' || (error instanceof Error && error.message.toLowerCase().includes('otp expired'))) {
      return 'The verification code has expired. Please request a new one.';
    }
    if (sbCode === 'over_email_send_rate_limit' || (error instanceof Error && error.message.toLowerCase().includes('rate limit'))) {
      return 'Too many code requests. Please wait a moment before trying again.';
    }
    if (
      sbCode === 'invalid_grant' ||
      (error instanceof Error &&
        (error.message.toLowerCase().includes('token is invalid') ||
          error.message.toLowerCase().includes('token has expired') ||
          error.message.toLowerCase().includes('invalid code')))
    ) {
      return 'Incorrect or expired code. Check the numbers and try again.';
    }
  }

  // ── Generic fallback ──────────────────────────────────────────────────────
  return 'Something went wrong. Please try again.';
}
