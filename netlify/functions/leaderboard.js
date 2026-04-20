// Netlify Function: /.netlify/functions/leaderboard
// GET  → returns top 10 scores from Netlify Blobs
// POST → accepts {name, score}, inserts into top 10 if it qualifies
//
// Storage: Netlify Blobs key-value store (native, zero setup).
// No external services, free tier.

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'rm-game';
const KEY = 'leaderboard';
const MAX_ENTRIES = 10;

function json(status, body) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

export default async (req, context) => {
  const store = getStore(STORE_NAME);

  if (req.method === 'GET') {
    const raw = await store.get(KEY, { type: 'json' });
    const scores = Array.isArray(raw) ? raw : [];
    return new Response(JSON.stringify({ scores }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); }
    catch (_) { return new Response(JSON.stringify({ error: 'bad json' }), { status: 400 }); }

    // sanitize input
    let name = String(body.name || 'ANON').trim().toUpperCase()
      .replace(/[^A-Z0-9 _-]/g, '').slice(0, 12) || 'ANON';
    const score = Number(body.score);
    if (!Number.isFinite(score) || score < 0 || score > 100000) {
      return new Response(JSON.stringify({ error: 'invalid score' }), { status: 400 });
    }

    const raw = await store.get(KEY, { type: 'json' });
    let scores = Array.isArray(raw) ? raw.slice() : [];

    scores.push({ name, score, ts: Date.now() });
    // dedupe: keep one entry per name (highest score)
    const byName = {};
    for (const s of scores) {
      if (!byName[s.name] || s.score > byName[s.name].score) byName[s.name] = s;
    }
    scores = Object.values(byName)
      .sort((a, b) => b.score - a.score || a.ts - b.ts)
      .slice(0, MAX_ENTRIES);

    await store.setJSON(KEY, scores);
    return new Response(JSON.stringify({ scores }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405 });
};
