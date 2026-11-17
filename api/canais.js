const { requireAuth } = require('../lib/auth');
const { readAll, saveAll } = require('../lib/storage');

function newId() {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function sanitize(ch) {
  const nome = String(ch.nome || '').trim().slice(0, 200);
  const categoria = String(ch.categoria || 'Geral').trim().slice(0, 100);
  const imagem = String(ch.imagem || '').trim().slice(0, 2000);
  const iframe = String(ch.iframe || '').trim().slice(0, 20000);
  const parental = ch.parental === true || ch.parental === 'true' || ch.parental === 1;
  const parental_senha = parental ? String(ch.parental_senha || '').slice(0, 100) : '';
  return { nome, categoria, imagem, iframe, parental, parental_senha };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const channels = await readAll();
      channels.sort((a, b) => {
        const c = String(a.categoria || '').localeCompare(String(b.categoria || ''));
        return c !== 0 ? c : String(a.nome || '').localeCompare(String(b.nome || ''));
      });
      return res.status(200).json({ canais: channels });
    }

    if (req.method === 'POST') {
      const auth = requireAuth(req, res);
      if (!auth) return;

      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Corpo inválido.' });

      const action = String(body.action || '');
      const channels = await readAll();

      if (action === 'add') {
        const ch = sanitize(body.canal || {});
        if (!ch.nome || !ch.iframe) return res.status(400).json({ error: 'Nome e iframe são obrigatórios.' });
        ch.id = newId();
        channels.push(ch);
        await saveAll(channels);
        return res.status(200).json({ success: true, canal: ch });
      }

      if (action === 'update') {
        const id = String(body.id || '');
        const idx = channels.findIndex(c => c.id === id);
        if (idx < 0) return res.status(404).json({ error: 'Canal não encontrado.' });
        const ch = sanitize(body.canal || {});
        if (!ch.nome || !ch.iframe) return res.status(400).json({ error: 'Nome e iframe são obrigatórios.' });
        ch.id = id;
        channels[idx] = ch;
        await saveAll(channels);
        return res.status(200).json({ success: true, canal: ch });
      }

      if (action === 'delete') {
        const id = String(body.id || '');
        const filtered = channels.filter(c => c.id !== id);
        if (filtered.length === channels.length) return res.status(404).json({ error: 'Canal não encontrado.' });
        await saveAll(filtered);
        return res.status(200).json({ success: true });
      }

      if (action === 'replace_all') {
        const list = Array.isArray(body.canais) ? body.canais : [];
        const cleaned = list.map(c => { const s = sanitize(c); s.id = c.id || newId(); return s; });
        await saveAll(cleaned);
        return res.status(200).json({ success: true, total: cleaned.length });
      }

      return res.status(400).json({ error: 'Ação desconhecida.' });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro interno.' });
  }
};