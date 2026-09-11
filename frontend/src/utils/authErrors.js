const MESSAGE_BY_CODE = {
  invalid_credentials: 'Invalid email or password.',
  email_not_confirmed: 'Please verify your email first. Enter the 6-digit code we sent you.',
  email_not_verified: 'Please verify your email first. Enter the 6-digit code we sent you.',
  user_already_registered: 'An account with this email already exists.',
  signup_disabled: 'New signups are currently disabled.',
  email_address_invalid: 'Please enter a valid email address.',
  weak_password: 'Password is too weak. Use at least 6 characters.',
  over_request_rate_limit: 'Too many attempts. Please wait and try again.',
  otp_expired: 'This link has expired. Please try again.',
  access_denied: 'Sign-in was cancelled or denied.',
  unexpected_failure: 'Something went wrong. Please try again.',
};

export function mapAuthError(error, fallback = 'Authentication failed. Please try again.') {
  if (!error) return fallback;

  const code = error.code || error.error || '';
  const raw = String(error.message || error.error_description || error.msg || '');
  const lower = raw.toLowerCase();

  if (MESSAGE_BY_CODE[code]) return MESSAGE_BY_CODE[code];

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return MESSAGE_BY_CODE.invalid_credentials;
  }
  if (lower.includes('email not confirmed') || lower.includes('verify your email')) {
    return MESSAGE_BY_CODE.email_not_confirmed;
  }
  if (lower.includes('already registered') || lower.includes('user already exists')) {
    return MESSAGE_BY_CODE.user_already_registered;
  }
  if (lower.includes('weak password') || lower.includes('password should be')) {
    return MESSAGE_BY_CODE.weak_password;
  }
  if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
    return MESSAGE_BY_CODE.email_address_invalid;
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Network error. Check your connection and try again.';
  }
  if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) {
    return 'This sign-in provider is not enabled in Supabase. Enable it under Authentication → Providers.';
  }
  if (lower.includes('access_denied') || lower.includes('denied')) {
    return MESSAGE_BY_CODE.access_denied;
  }

  if (lower.includes('database error saving new user') || lower.includes('email_verified')) {
    return 'Could not create your profile. Run supabase/email_verification.sql in the Supabase SQL Editor, then try again.';
  }
  if (lower.includes('error sending confirmation email') || lower.includes('error sending recovery email')) {
    return 'Account was created, but the confirmation email could not be sent. Try signing up again or use Resend code.';
  }
  if (raw && raw.length < 200) {
    return raw;
  }

  return fallback;
}

export function toAppUser(profile, authUser) {
  const metadata = authUser?.user_metadata || {};
  const identities = authUser?.identities || [];
  const oauth = identities.some((item) => item?.provider && item.provider !== 'email');
  return {
    id: profile?.id || authUser?.id,
    name: profile?.name || metadata.name || metadata.full_name || authUser?.email?.split('@')[0] || 'User',
    email: profile?.email || authUser?.email || '',
    phoneNumber: profile?.phone_number || profile?.phoneNumber || metadata.phone_number || '',
    avatarUrl: profile?.avatar_url || profile?.avatarUrl || metadata.avatar_url || metadata.avatarUrl || '',
    createdAt: profile?.created_at || profile?.createdAt || authUser?.created_at || '',
    emailVerified: profile?.email_verified !== false && profile?.emailVerified !== false,
    passwordLogin: !oauth,
  };
}
