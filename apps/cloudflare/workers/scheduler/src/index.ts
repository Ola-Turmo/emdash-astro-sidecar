export interface Env {
  ORCHESTRATOR_URL?: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (!env.ORCHESTRATOR_URL) {
      console.warn('ORCHESTRATOR_URL is not configured.');
      return;
    }

    ctx.waitUntil(
      fetch(env.ORCHESTRATOR_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'scheduled_tick',
          at: new Date().toISOString(),
        }),
      }),
    );
  },
};
