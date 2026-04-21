/**
 * Cloudflare Worker entrypoint for rebeccamuze.club
 *
 * Routes:
 *   /api/leaderboard   → Flappy Skull leaderboard (KV-backed)
 *   everything else    → static site (env.ASSETS)
 *
 * Bindings required (set in wrangler.jsonc or the Cloudflare dashboard):
 *   ASSETS       — static assets (auto-injected when `assets.binding` is set)
 *   LEADERBOARD  — KV namespace for leaderboard storage
 */

const KEY = 'top';
const MAX_ROWS = 10;
const NAME_MAX = 12;
const SCORE_CEILING = 99999;

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

// admin secret for the DELETE endpoint — used only to wipe the
// leaderboard during launch. Rotate or remove once it's no longer
// needed; if leaked the worst case is someone clears the scoreboard.
const ADMIN_SECRET = 'muze-clear-2026';

async function handleLeaderboard(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method === 'GET') {
    const board = await readBoard(env);
    return json({ scores: board.slice(0, MAX_ROWS) });
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    if (url.searchParams.get('secret') !== ADMIN_SECRET) {
      return json({ error: 'forbidden' }, 403);
    }
    if (!env.LEADERBOARD) {
      return json({ error: 'leaderboard not configured' }, 503);
    }
    await writeBoard(env, []);
    return json({ scores: [] });
  }

  if (request.method === 'POST') {
    if (!env.LEADERBOARD) {
      return json({ error: 'leaderboard not configured (missing KV binding)' }, 503);
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

  return json({ error: 'method not allowed' }, 405);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/leaderboard') {
      return handleLeaderboard(request, env);
    }

    // fall through to static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not Found', { status: 404 });
  },
};
