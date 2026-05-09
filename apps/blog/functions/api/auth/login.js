import { verifyPassword, createSession, dbQuery } from "../../utils/db.js";

export async function onRequestPost(context) {
  try {
    const { email, password } = await context.request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    let user = null;
    const dbResult = await dbQuery(context, "SELECT id, email, name, plan, password_hash FROM users WHERE email = ?", [email]);
    
    if (dbResult.results?.length > 0) {
      user = dbResult.results[0];
      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid credentials" }), {
          status: 401, headers: { "Content-Type": "application/json" }
        });
      }
    } else if (context.env.EMDASH_CONTENT_CACHE) {
      const kvUser = await context.env.EMDASH_CONTENT_CACHE.get(`user:${email}`);
      if (kvUser) {
        user = JSON.parse(kvUser);
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), {
            status: 401, headers: { "Content-Type": "application/json" }
          });
        }
      }
    }

    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401, headers: { "Content-Type": "application/json" }
      });
    }

    const token = await createSession({ id: user.id, email: user.email, name: user.name, plan: user.plan }, context.env);
    return new Response(JSON.stringify({ success: true, user: { id: user.id, email: user.email, name: user.name, plan: user.plan } }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
}
