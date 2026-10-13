// Browsers (Chrome especially) key their "previously typed values" suggestion list on the
// input's `name` (or on its `id` when there is no name) and largely ignore autocomplete="off".
// A random per-mount `name` means there is never a stable key to accumulate or match against.
// Same idea as the login employee field and the order-item model search (reports 2a4a2af4, 0a88cf56,
// and the email-suggestions complaint: "I don't want previously typed e-mail addresses offered").
//
// Usage (one hook call per component, then spread per field):
//   const nf = useNoFill();
//   <input id="x" type="email" {...nf('email')} value={...} onChange={...} />
// The spread sets: a random per-mount `name`, data-field="email" (the logical field name),
// autoComplete="new-password" (Chrome treats "off" as a hint it may ignore, a new-password hint it
// does not offer address/history suggestions for) and the password-manager opt-out attributes.
//
// Handlers that used to read `e.target.name` must read the logical name instead: fieldOf(e.target).
//
// The random value is produced in an effect (not during render) so the server HTML and the first
// client render agree (no hydration mismatch) - before the effect there is simply no `name` attribute.
// scripts/test_email_autofill_guard.mjs fails when an e-mail input in a customer / e-mail form
// loses this protection.
import { useEffect, useState } from 'react';

export const NO_FILL_ATTRS = { autoComplete: 'new-password', 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };

export function useAutofillGuard() {
  const [salt, setSalt] = useState(null);
  useEffect(() => {
    setSalt(Math.random().toString(36).slice(2, 10));
  }, []);
  return (field) => (salt ? `no-autofill-${field}-${salt}` : undefined);
}

/** Props that switch off the browser's typing-history / autofill suggestions for one field. */
export function useNoFill() {
  const ag = useAutofillGuard();
  return (field) => ({ ...NO_FILL_ATTRS, name: ag(field), 'data-field': field });
}

// Reads the logical field name of an input that may carry a randomised `name`.
export function fieldOf(target) {
  return (target && target.dataset && target.dataset.field) || (target && target.name) || '';
}
