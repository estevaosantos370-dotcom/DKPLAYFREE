const { requireAuth } = require('../lib/auth');
const { readAll, saveAll } = require('../lib/storage');

function newId() {
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function sanitize(ch) {
  return {
    nome: String(ch.nome || '').trim().slice(0, 200),
    categoria: String(ch.categoria || 'Geral').trim().slice(0, 100),
    imagem: String(ch.imagem || '').trim().slice(0, 2000),
    iframe: String(ch.iframe || '').trim().slice(0, 20000),
    parental: ch.parental === true || ch.parental === 'true' || ch.parental === 1,
    parental_senha: ch.parental === true ? String(ch.parental_senha || '').slice(0, 100) : ''
  };
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
      if (!requireAuth(req, res)) return;

      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
      if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Corpo inválido.' });

      const action = String(body.action || '');
      const channels = await readAll();

      if (action === 'add') {
        const ch = sanitize(body.canal || {});
        if (!ch.nome) return res.status(400).json({ error: 'Nome é obrigatório.' });
        if (!ch.iframe) return res.status(400).json({ error: 'Iframe é obrigatório.' });
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
        if (!ch.nome) return res.status(400).json({ error: 'Nome é obrigatório.' });
        if (!ch.iframe) return res.status(400).json({ error: 'Iframe é obrigatório.' });
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

      return res.status(400).json({ error: 'Ação desconhecida.' });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (e) {
    console.error('[api/canais] erro:', e);
    return res.status(500).json({ error: e.message || 'Erro interno.' });
  }
};
