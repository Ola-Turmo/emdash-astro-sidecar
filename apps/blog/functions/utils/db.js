// Database utilities for D1 with KV fallback

const JWT_SECRET = "emdash-jwt-secret-change-in-production";

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", data, "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  const combined = new Uint8Array(salt.length + hash.byteLength);
  combined.set(salt, 0);
  combined.set(new Uint8Array(hash), salt.length);
  return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(password, stored) {
  const storedBuf = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
  const salt = storedBuf.slice(0, 16);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  const hashArr = new Uint8Array(hash);
  for (let i = 0; i < hashArr.length; i++) {
    if (hashArr[i] !== storedBuf[16 + i]) return false;
  }
  return true;
}

export async function createSession(user, env) {
  const payload = { sub: user.id, email: user.email, name: user.name, plan: user.plan };
  const header = { alg: "HS256", typ: "JWT" };
  const enc = new TextEncoder();
  const b64 = obj => btoa(JSON.stringify(obj)).replace(/=+$/, "");
  const data = `${b64(header)}.${b64(payload)}`;
  const sig = await crypto.subtle.sign("HMAC", await importJwtKey(env), enc.encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, "")}`;
}

export async function verifySession(token, env) {
  if (!token) return null;
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const data = `${h}.${p}`;
    const enc = new TextEncoder();
    const sig = Uint8Array.from(atob(s.padEnd(s.length + (4 - s.length % 4) % 4, "=")), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", await importJwtKey(env), sig, enc.encode(data));
    if (!valid) return null;
    return JSON.parse(atob(p));
  } catch {
    return null;
  }
}

async function importJwtKey(env) {
  const secret = env.JWT_SECRET || JWT_SECRET;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

// D1 helpers with KV fallback
export async function getDb(env) {
  if (env.DB) return { type: "d1", db: env.DB };
  if (env.EMDASH_CONTENT_CACHE) return { type: "kv", kv: env.EMDASH_CONTENT_CACHE };
  return { type: "none" };
}

export async function dbQuery(ctx, sql, params) {
  const { type, db, kv } = await getDb(ctx.env);
  if (type === "d1") {
    return db.prepare(sql).bind(...(params || [])).all();
  }
  if (type === "kv") {
    // KV fallback - store/retrieve JSON records
    return { results: [], fallback: true };
  }
  return { results: [], fallback: true };
}

export async function dbExec(ctx, sql, params) {
  const { type, db } = await getDb(ctx.env);
  if (type === "d1") {
    return db.prepare(sql).bind(...(params || [])).run();
  }
  return { success: false, fallback: true };
}
