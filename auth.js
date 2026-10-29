// Hashowanie hasel (scrypt z wbudowanego modulu crypto) + podpisane sesje w ciasteczku.
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  if (!stored || stored.indexOf(':') === -1) {
    // Tryb awaryjny: porownanie plain-text z .env (gdy nie zahaszowano).
    return safeEqualStr(password, stored || '');
  }
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(test, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function safeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// --- Sesja: podpisany token w ciasteczku (HMAC-SHA256) ---
function sign(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return data + '.' + sig;
}

function verify(token, secret) {
  if (!token || token.indexOf('.') === -1) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (!safeEqualStr(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { hashPassword, verifyPassword, safeEqualStr, sign, verify, randomToken };
