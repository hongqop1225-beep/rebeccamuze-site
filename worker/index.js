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

// ==========================================================================
// CLUB — fan wall (mini social feed inside the site, no email required)
// ==========================================================================
// Fans pick a handle, post short messages, heart each other's posts.
// Identity is browser-local (LocalStorage on the client) — no accounts,
// no passwords, no email. Low-stakes community vibe, maximum accessibility.
//
// Storage layout (single KV namespace, LEADERBOARD, reused):
//   club:posts    → array of { id, handle, message, ts, likes }
//   club:handles  → array of lowercase handles already in use (for dedupe)
//   rate:<ip>     → last-post timestamp per IP, TTL 30s (spam brake)
//
// Admin delete uses the same ?secret=muze-clear-2026 pattern as the
// leaderboard — rotate if leaked, worst case someone nukes fan posts.

const CLUB_POSTS_KEY = 'club:posts';
const CLUB_HANDLES_KEY = 'club:handles';
const CLUB_MAX_POSTS = 300;           // keep the newest N, trim older
const CLUB_HANDLE_MIN = 2;
const CLUB_HANDLE_MAX = 20;
const CLUB_MESSAGE_MAX = 280;
const CLUB_RATE_WINDOW_SEC = 30;       // one post per IP per 30s
const CLUB_LIKE_CEILING = 9999;

// Handles nobody else can claim — protects the artist + label identity.
// Compared lowercase, stripped of leading @.
const CLUB_RESERVED = new Set([
  'rebecca', 'rebeccamuze', 'rebecca_muze', 'rebecca9muses', 'rebecca_9muses',
  'muze', '9muses', 'vela', 'velarecords', 'vela_records',
  'admin', 'mod', 'moderator', 'official', 'staff', 'system', 'root',
]);

function normalizeHandle(raw) {
  if (typeof raw !== 'string') return null;
  // strip leading @, lowercase, trim
  let h = raw.replace(/^@+/, '').trim().toLowerCase();
  // only allow letters, numbers, underscore — keeps URLs + moderation sane
  if (!/^[a-z0-9_]+$/.test(h)) return null;
  if (h.length < CLUB_HANDLE_MIN || h.length > CLUB_HANDLE_MAX) return null;
  return h;
}

function sanitizeMessage(raw) {
  if (typeof raw !== 'string') return null;
  // strip control chars, trim, cap length
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, CLUB_MESSAGE_MAX);
}

async function readPosts(env) {
  if (!env.LEADERBOARD) return [];
  try {
    const raw = await env.LEADERBOARD.get(CLUB_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function writePosts(env, posts) {
  if (!env.LEADERBOARD) return;
  await env.LEADERBOARD.put(CLUB_POSTS_KEY, JSON.stringify(posts));
}

async function readHandles(env) {
  if (!env.LEADERBOARD) return [];
  try {
    const raw = await env.LEADERBOARD.get(CLUB_HANDLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

async function writeHandles(env, handles) {
  if (!env.LEADERBOARD) return;
  await env.LEADERBOARD.put(CLUB_HANDLES_KEY, JSON.stringify(handles));
}

// Simple per-IP rate limit. Uses KV TTL so we don't need cleanup cron.
async function isRateLimited(env, ip) {
  if (!env.LEADERBOARD || !ip) return false;
  const key = `rate:${ip}`;
  const hit = await env.LEADERBOARD.get(key);
  if (hit) return true;
  await env.LEADERBOARD.put(key, '1', { expirationTtl: CLUB_RATE_WINDOW_SEC });
  return false;
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') ||
         request.headers.get('x-forwarded-for') ||
         'unknown';
}

// Short random ID for post addressing (collision-resistant for our size).
function newPostId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

async function handleClubPosts(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // ---------- GET: fetch the wall ----------
  if (request.method === 'GET') {
    const posts = await readPosts(env);
    return json({ posts });
  }

  // ---------- POST: new fan letter ----------
  if (request.method === 'POST') {
    if (!env.LEADERBOARD) {
      return json({ error: 'club not configured (missing KV binding)' }, 503);
    }

    // rate-limit BEFORE parsing body — cheapest possible guard
    const ip = clientIp(request);
    if (await isRateLimited(env, ip)) {
      return json({ error: 'slow down — one post per 30 seconds' }, 429);
    }

    let body;
    try { body = await request.json(); }
    catch (_) { return json({ error: 'invalid json' }, 400); }

    // honeypot — any value in this field means bot, drop silently
    if (body && body.website) {
      return json({ ok: true }); // pretend it worked, bin the data
    }

    const handle = normalizeHandle(body && body.handle);
    const message = sanitizeMessage(body && body.message);
    if (!handle) return json({ error: 'invalid handle — letters, numbers, underscore only (2-20 chars)' }, 400);
    if (!message) return json({ error: 'message required' }, 400);
    if (CLUB_RESERVED.has(handle)) {
      return json({ error: 'that handle is reserved — pick another' }, 403);
    }

    const post = {
      id: newPostId(),
      handle,
      message,
      ts: Date.now(),
      likes: 0,
    };

    const posts = await readPosts(env);
    posts.unshift(post); // newest first
    const trimmed = posts.slice(0, CLUB_MAX_POSTS);
    await writePosts(env, trimmed);

    // track handle (non-blocking, best effort)
    try {
      const handles = await readHandles(env);
      if (!handles.includes(handle)) {
        handles.push(handle);
        await writeHandles(env, handles.slice(-5000));
      }
    } catch (_) { /* ignore */ }

    return json({ post, posts: trimmed });
  }

  // ---------- DELETE: admin wipe / single-post delete ----------
  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    if (url.searchParams.get('secret') !== ADMIN_SECRET) {
      return json({ error: 'forbidden' }, 403);
    }
    if (!env.LEADERBOARD) {
      return json({ error: 'club not configured' }, 503);
    }
    const postId = url.searchParams.get('id');
    if (postId) {
      // delete a specific post
      const posts = await readPosts(env);
      const filtered = posts.filter(p => p.id !== postId);
      await writePosts(env, filtered);
      return json({ posts: filtered, deleted: postId });
    }
    // wipe all
    await writePosts(env, []);
    return json({ posts: [] });
  }

  return json({ error: 'method not allowed' }, 405);
}

// Like/unlike — simple counter increment. Client-side tracks which posts
// this browser has liked (LocalStorage), we just trust the request and
// rely on the rate limit + per-browser UI to prevent abuse.
async function handleClubLike(request, env, postId) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }
  if (!env.LEADERBOARD) {
    return json({ error: 'club not configured' }, 503);
  }
  if (!postId) return json({ error: 'post id required' }, 400);

  const posts = await readPosts(env);
  const idx = posts.findIndex(p => p.id === postId);
  if (idx === -1) return json({ error: 'post not found' }, 404);

  // optional body: { delta: 1 } (like) or { delta: -1 } (unlike)
  let delta = 1;
  try {
    const body = await request.json();
    if (body && body.delta === -1) delta = -1;
  } catch (_) { /* default +1 */ }

  posts[idx].likes = Math.max(0, Math.min(CLUB_LIKE_CEILING, (posts[idx].likes || 0) + delta));
  await writePosts(env, posts);
  return json({ post: posts[idx] });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/leaderboard') {
      return handleLeaderboard(request, env);
    }

    // club endpoints
    if (url.pathname === '/api/club/posts') {
      return handleClubPosts(request, env);
    }
    // /api/club/posts/<id>/like
    const likeMatch = url.pathname.match(/^\/api\/club\/posts\/([^/]+)\/like$/);
    if (likeMatch) {
      return handleClubLike(request, env, likeMatch[1]);
    }

    // fall through to static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not Found', { status: 404 });
  },
};
