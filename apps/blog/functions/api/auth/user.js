import { verifySession, dbQuery } from "../../utils/db.js";

export async function onRequestGet(context) {
  const cookie = context.request.headers.get("Cookie") || "";
  const sessionToken = cookie.match(/session=([^;]+)/)?.[1];
  const session = await verifySession(sessionToken, context.env);
  
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" }
    });
  }

  let user = null;
  const dbResult = await dbQuery(context, "SELECT id, email, name, company, website, plan, created_at FROM users WHERE id = ?", [session.sub]);
  if (dbResult.results?.length > 0) {
    user = dbResult.results[0];
  } else if (context.env.EMDASH_CONTENT_CACHE) {
    const keys = await context.env.EMDASH_CONTENT_CACHE.list({ prefix: "user:" });
    for (const key of keys.keys || []) {
      const data = await context.env.EMDASH_CONTENT_CACHE.get(key.name);
      if (data) {
        const u = JSON.parse(data);
        if (String(u.id) === String(session.sub)) {
          user = u;
          break;
        }
      }
    }
  }

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404, headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name, company: user.company, website: user.website, plan: user.plan, created_at: user.created_at } }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
}
