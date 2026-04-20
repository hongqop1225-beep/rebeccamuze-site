/**
 * Flappy Skull leaderboard — Cloudflare Pages Function.
 *
 * Binding required (set in Cloudflare dashboard → Pages → project → Settings
 * → Functions → KV namespace bindings):
 *   Variable name: LEADERBOARD
 *   KV namespace:  (create one called "rm-leaderboard" and bind it)
 *
 * Storage model: one JSON array under key "top" — cheap, atomic, good enough
 * for a global top-10 board (reads/writes are small).
 *
 * Endpoints:
 *   GET  /api/leaderboard   → { scores: [{ name, score, ts }, ...] }   top 10
 *   POST /api/leaderboard   body: { name, score }   → updated top 10
 */

const KEY = 'top';
const MAX_ROWS = 10;
const NAME_MAX = 12;
const SCORE_CEILING = 99999; // sanity cap
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...CORS,
    },
  });
}

function sanitizeName(raw) {
  if (typeof raw !== 'string') return 'anon';
  // strip control chars & collapse whitespace
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned) return 'anon';
  return cleaned.slice(0, NAME_MAX);
}

function sanitizeScore(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  const int = Math.floor(n);
  if (int <= 0 || int > SCORE_CEILING) return NaN;
  return int;
}

async function readBoard(env) {
  if (!env.LEADERBOARD) return [];
  try {
    const raw = await env.LEADERBOARD.get(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function writeBoard(env, board) {
  if (!env.LEADERBOARD) return;
  await env.LEADERBOARD.put(KEY, JSON.stringify(board));
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ env }) {
  const board = await readBoard(env);
  return json({ scores: board.slice(0, MAX_ROWS) });
}

export async function onRequestPost({ request, env }) {
  if (!env.LEADERBOARD) {
    return json({ error: 'leaderboard not configured' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: 'invalid json' }, 400);
  }

  const name = sanitizeName(body && body.name);
  const score = sanitizeScore(body && body.score);
  if (!Number.isFinite(score)) {
    return json({ error: 'invalid score' }, 400);
  }

  const board = await readBoard(env);
  board.push({ name, score, ts: Date.now() });
  board.sort((a, b) => b.score - a.score);
  const trimmed = board.slice(0, MAX_ROWS);
  await writeBoard(env, trimmed);

  return json({ scores: trimmed });
}
