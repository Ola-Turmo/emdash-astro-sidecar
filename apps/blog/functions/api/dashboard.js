import { verifySession, dbQuery } from "../utils/db.js";

export async function onRequestGet(context) {
  const cookie = context.request.headers.get("Cookie") || "";
  const sessionToken = cookie.match(/session=([^;]+)/)?.[1];
  const session = await verifySession(sessionToken, context.env);

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Fetch user's projects
  let projects = [];
  const dbProjects = await dbQuery(context, "SELECT id, name, domain, status, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC", [session.sub]);
  if (dbProjects.results?.length > 0) {
    projects = dbProjects.results;
  } else if (context.env.EMDASH_CONTENT_CACHE) {
    const keys = await context.env.EMDASH_CONTENT_CACHE.list({ prefix: `project:${session.sub}:` });
    for (const key of keys.keys || []) {
      const data = await context.env.EMDASH_CONTENT_CACHE.get(key.name);
      if (data) projects.push(JSON.parse(data));
    }
  }

  // Fetch user stats
  const stats = {
    articlesPublished: projects.reduce((sum, p) => sum + (p.articles_count || 0), 0),
    articlesGenerated: projects.reduce((sum, p) => sum + (p.generated_count || 0), 0),
    sitesConnected: projects.length,
    seoScore: projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + (p.seo_score || 75), 0) / projects.length) : 0
  };

  // Recent activity (mock if no data)
  const activity = [
    { action: "Account created", time: "Just now", icon: "user" }
  ];

  return new Response(JSON.stringify({ projects, stats, activity, plan: session.plan }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
