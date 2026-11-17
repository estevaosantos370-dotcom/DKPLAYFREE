const fs = require('node:fs/promises');
const path = require('node:path');

const BLOB_KEY = 'darkplay/canais.json';
const STATIC_PATH = path.join(process.cwd(), 'data', 'canais.json');

async function readStatic() {
  try {
    const raw = await fs.readFile(STATIC_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function readFromBlob() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const { list } = require('@vercel/blob');
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch { return null; }
}

async function readAll() {
  const fromBlob = await readFromBlob();
  if (fromBlob) return fromBlob;
  return readStatic();
}

async function saveAll(channels) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN não configurado na Vercel. Crie um Blob Store no dashboard.');
  }
  const { put, list, del } = require('@vercel/blob');
  const existing = await list({ prefix: BLOB_KEY });
  if (existing.blobs.length) await del(existing.blobs.map(b => b.url));
  await put(BLOB_KEY, JSON.stringify(channels, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false
  });
}

module.exports = { readAll, saveAll };