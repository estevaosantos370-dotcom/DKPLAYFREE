const fs = require('node:fs/promises');
const path = require('node:path');

const BLOB_KEY = 'darkplay/canais.json';
const STATIC_PATH = path.join(process.cwd(), 'data', 'canais.json');

function getToken() {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) {
    throw new Error('BLOB_READ_WRITE_TOKEN não configurado. Crie um Blob Store na Vercel e adicione a variável de ambiente.');
  }
  if (!t.startsWith('vercel_blob_rw_')) {
    throw new Error('BLOB_READ_WRITE_TOKEN inválido. O valor correto começa com "vercel_blob_rw_". Você colou o exemplo de código (import { put }...) no lugar do token real.');
  }
  return t;
}

async function readStatic() {
  try {
    const raw = await fs.readFile(STATIC_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function readFromBlob() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !token.startsWith('vercel_blob_rw_')) return null;
  try {
    const { list } = require('@vercel/blob');
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    if (!blobs.length) return null;
    const candidates = [blobs[0].downloadUrl, blobs[0].url].filter(Boolean);
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data)) return data;
      } catch { /* tenta o próximo */ }
    }
    return null;
  } catch { return null; }
}

async function readAll() {
  const fromBlob = await readFromBlob();
  if (fromBlob) return fromBlob;
  return readStatic();
}

async function saveAll(channels) {
  const token = getToken();
  const { put, list, del } = require('@vercel/blob');
  const content = JSON.stringify(channels, null, 2);

  // limpa versões antigas
  try {
    const existing = await list({ prefix: BLOB_KEY });
    if (existing.blobs.length) await del(existing.blobs.map(b => b.url));
  } catch { /* segue mesmo assim */ }

  const base = { contentType: 'application/json', addRandomSuffix: false };

  try {
    await put(BLOB_KEY, content, { ...base, access: 'public' });
    return;
  } catch (e1) {
    try {
      await put(BLOB_KEY, content, { ...base, access: 'private' });
      return;
    } catch (e2) {
      throw new Error(
        'Falha ao salvar no Vercel Blob. ' +
        'Public: ' + (e1.message || 'erro') + ' | ' +
        'Private: ' + (e2.message || 'erro') + '. ' +
        'Verifique se o Blob Store existe e se o token é o correto (começa com vercel_blob_rw_).'
      );
    }
  }
}

module.exports = { readAll, saveAll };
