/**
 * Normalizes an email address.
 * If no domain/extension is present (e.g. "pesirubin" or "user@"), appends @gmail.com (or gmail.com).
 * Fixes slashes in domain like /COM -> .com, /ORG -> .org.
 * Fixes domains without extension like "user@outlook" -> "user@outlook.com".
 */
export function normalizeEmail(rawEmail, rawSuffix = '') {
  if (!rawEmail && !rawSuffix) return null;
  let email = (rawEmail || '').trim();
  let suffix = (rawSuffix || '').trim();

  // If email is empty, check suffix
  if (!email) {
    if (!suffix) return null;
    if (suffix.toLowerCase().includes('gmail.com') || suffix === '@' || suffix === '.') return null;
    email = suffix;
    suffix = '';
  }

  // If email is just '@gmail.com' or '@gmail' or '@' or '.' without username
  if (/^@gmail(\.com)?$/i.test(email) || email === '@' || email === '.') {
    return null;
  }

  // Fix slashes in domains like AVI@MNIVEN/COM or RK@OHELSARA/ORG
  email = email.replace(/\/COM/gi, '.com');
  email = email.replace(/\/ORG/gi, '.org');
  email = email.replace(/\/CO\.IL/gi, '.co.il');
  email = email.replace(/\/ORG\.IL/gi, '.org.il');
  email = email.replace(/\/NET/gi, '.net');
  email = email.replace(/\//g, '.');

  email = email.trim();

  if (suffix) {
    suffix = suffix.replace(/^@/, '').trim();
    if (suffix.startsWith('./')) suffix = suffix.replace(/^\.\//, '.');
  }

  // If email does not contain '@'
  if (!email.includes('@')) {
    if (suffix && suffix.includes('.')) {
      email = email + '@' + suffix;
    } else {
      email = email + '@gmail.com';
    }
  } else if (email.endsWith('@')) {
    if (suffix && suffix.includes('.')) {
      email = email + suffix;
    } else {
      email = email + 'gmail.com';
    }
  } else {
    // Email contains '@'
    const parts = email.split('@');
    const username = parts[0].trim();
    let domain = parts.slice(1).join('@').trim();

    if (!domain) {
      domain = 'gmail.com';
    } else if (!domain.includes('.')) {
      const lowerDom = domain.toLowerCase();
      if (lowerDom === 'gmail') domain = 'gmail.com';
      else if (lowerDom === 'outlook') domain = 'outlook.com';
      else if (lowerDom === 'hotmail') domain = 'hotmail.com';
      else if (lowerDom === 'yahoo') domain = 'yahoo.com';
      else if (lowerDom === 'walla') domain = 'walla.co.il';
      else {
        domain = domain + '.com';
      }
    }
    email = username + '@' + domain;
  }

  // Clean up duplicate @ signs
  email = email.replace(/@+/g, '@');
  return email;
}
