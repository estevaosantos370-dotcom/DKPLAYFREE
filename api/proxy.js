const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const target = req.query.url;
  if (!target || typeof target !== 'string') return res.status(400).json({ error: 'Parâmetro url obrigatório.' });

  let parsed;
  try { parsed = new URL(target); } catch { return res.status(400).json({ error: 'URL inválida.' }); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return res.status(400).json({ error: 'Somente http:// ou https://.' });

  try {
    const headers = {
      'User-Agent': process.env.STREAM_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: '*/*'
    };
    if (req.headers.range) headers.Range = req.headers.range;

    const upstream = await fetch(parsed.toString(), { headers, redirect: 'follow' });

    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json({ error: `Upstream respondeu HTTP ${upstream.status}. Verifique se o canal está online.` });
    }

    const ct = upstream.headers.get('content-type') || '';
    const isM3u8 = /mpegurl/i.test(ct) || /\.m3u8(\?|$)/i.test(parsed.pathname + parsed.search);

    if (isM3u8) {
      let text = await upstream.text();
      const base = parsed;
      text = text.split(/\r?\n/).map(line => {
        const t = line.trim();
        if (!t) return line;
        if (t.startsWith('#')) {
          return line.replace(/URI="([^"]+)"/g, (m, u) => {
            try { return `URI="/api/proxy?url=${encodeURIComponent(new URL(u, base).toString())}"`; }
            catch { return m; }
          });
        }
        try { return `/api/proxy?url=${encodeURIComponent(new URL(t, base).toString())}`; }
        catch { return line; }
      }).join('\n');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(text);
    }

    res.setHeader('Content-Type', ct || 'application/octet-stream');
    for (const h of ['content-length', 'content-range', 'accept-ranges']) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.statusCode = upstream.status;
    if (!upstream.body) return res.end();
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (e) {
    console.error('[api/proxy] erro:', e);
    return res.status(502).json({ error: 'Falha ao buscar stream: ' + (e.message || 'erro') });
  }
};