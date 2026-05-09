import { hashPassword, createSession, dbExec, dbQuery } from "../../utils/db.js";

export async function onRequestPost(context) {
  try {
    const { email, password, name, company, website } = await context.request.json();
    
    if (!email || !password || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email and password required" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const existing = await dbQuery(context, "SELECT id FROM users WHERE email = ?", [email]);
    if (existing.results?.length > 0) {
      return new Response(JSON.stringify({ error: "Email already registered" }), { 
        status: 409, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const passwordHash = await hashPassword(password);
    const result = await dbExec(context, 
      "INSERT INTO users (email, name, password_hash, company, website, plan) VALUES (?, ?, ?, ?, ?, ?)",
      [email, name || null, passwordHash, company || null, website || null, "starter"]
    );

    if (result.fallback) {
      // KV fallback - store user record
      const userId = crypto.randomUUID();
      const userData = { id: userId, email, name: name || null, company: company || null, website: website || null, plan: "starter", created_at: new Date().toISOString() };
      await context.env.EMDASH_CONTENT_CACHE?.put(`user:${email}`, JSON.stringify({ ...userData, password_hash: passwordHash }));
      const token = await createSession(userData, context.env);
      return new Response(JSON.stringify({ success: true, user: { id: userId, email, name, plan: "starter" } }), {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
        }
      });
    }

    const userId = result.meta?.last_row_id || result.lastRowId;
    const token = await createSession({ id: userId, email, name: name || null, plan: "starter" }, context.env);

    return new Response(JSON.stringify({ success: true, user: { id: userId, email, name, plan: "starter" } }), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ message: "Use POST to sign up" }), { 
    status: 405, 
    headers: { "Content-Type": "application/json" } 
  });
}
