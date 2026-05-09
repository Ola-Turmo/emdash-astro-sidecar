import { dbExec, dbQuery } from "../utils/db.js";

export async function onRequestPost(context) {
  try {
    const { email, company, website, useCase } = await context.request.json();
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    const existing = await dbQuery(context, "SELECT id FROM waitlist WHERE email = ?", [email]);
    if (existing.results?.length > 0) {
      return new Response(JSON.stringify({ success: true, message: "Already on the list" }), {
        status: 200, headers: { "Content-Type": "application/json" }
      });
    }

    const result = await dbExec(context,
      "INSERT INTO waitlist (email, company, website, use_case) VALUES (?, ?, ?, ?)",
      [email, company || null, website || null, useCase || null]
    );

    if (result.fallback && context.env.EMDASH_CONTENT_CACHE) {
      await context.env.EMDASH_CONTENT_CACHE.put(`waitlist:${email}`, JSON.stringify({ email, company, website, useCase, created_at: new Date().toISOString() }));
    }

    return new Response(JSON.stringify({ success: true, message: "You are on the list. We will email you when access is ready." }), {
      status: 201, headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
}
