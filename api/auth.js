const crypto = require('node:crypto');
const { sign, verify, parseCookies } = require('../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const payload = verify(parseCookies(req).admin_token);
    return res.status(200).json({ authenticated: !!payload });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const password = String(body?.password || '');
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) return res.status(503).json({ error: 'ADMIN_PASSWORD não configurado no servidor.' });

    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return res.status(401).json({ error: 'Senha incorreta.' });

    const token = sign({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    res.setHeader('Set-Cookie', `admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Método não permitido.' });
};