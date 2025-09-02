// Simple, RFC 5322-inspired email regex suitable for app validation (not exhaustive)
// Allows common email formats and rejects obvious invalid ones.
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (trimmed.length === 0) return false;
  return EMAIL_REGEX.test(trimmed);
}

export function uniqueValidEmails(emails: string[]): string[] {
  const set = new Set<string>();
  for (const raw of emails) {
    const e = raw.trim();
    if (isValidEmail(e)) set.add(e.toLowerCase());
  }
  return Array.from(set);
}


