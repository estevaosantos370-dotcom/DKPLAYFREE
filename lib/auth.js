const crypto = require('node:crypto');

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('AUTH_SECRET ausente (mínimo 16 caracteres).');
  return s;
}

function sign(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const [data, hmac] = token.split('.');
  if (!data || !hmac) return null;
  const expected = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  if (hmac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

function requireAuth(req, res) {
  const payload = verify(parseCookies(req).admin_token);
  if (!payload) {
    res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
    return null;
  }
  return payload;
}

module.exports = { sign, verify, parseCookies, requireAuth };
