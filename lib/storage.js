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
    throw new Error('BLOB_READ_WRITE_TOKEN inválido. O valor correto começa com "vercel_blob_rw_".');
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
    const { get } = require('@vercel/blob');

    // get() autenticado, obrigatório em stores privados
    const result = await get(BLOB_KEY, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return null;

    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function readAll() {
  const fromBlob = await readFromBlob();
  if (fromBlob) return fromBlob;
  return readStatic();
}

async function saveAll(channels) {
  getToken(); // valida o token

  const { put, list, del } = require('@vercel/blob');
  const content = JSON.stringify(channels, null, 2);

  // remove versões antigas do mesmo pathname
  try {
    const existing = await list({ prefix: BLOB_KEY });
    if (existing.blobs.length) {
      await del(existing.blobs.map(b => b.url));
    }
  } catch { /* segue mesmo assim */ }

  // Store privado: access precisa ser 'private'
  await put(BLOB_KEY, content, {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false
  });
}

module.exports = { readAll, saveAll };
