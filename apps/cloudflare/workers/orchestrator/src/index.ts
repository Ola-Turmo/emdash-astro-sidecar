import {
  buildAutonomousRunPlan,
  defaultHostBudgets,
  isHostMode,
  type HostMode,
} from '../../../../../packages/content-policy/src/index';

export interface Env {
  SYSTEM_NAME: string;
}

interface OrchestratorPayload {
  hostId?: string;
  hostName?: string;
  mode?: string;
  at?: string;
  reason?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const payload = (await request.json().catch(() => ({}))) as OrchestratorPayload;
    const mode: HostMode = isHostMode(payload.mode) ? payload.mode : 'draft_only';
    const runPlan = buildAutonomousRunPlan(mode);
    const hostId = payload.hostId ?? 'default-host';

    return Response.json({
      ok: true,
      system: env.SYSTEM_NAME,
      received: payload,
      host: {
        id: hostId,
        name: payload.hostName ?? hostId,
        mode,
        budgets: defaultHostBudgets(),
      },
      runPlan,
      note: 'Reusable orchestrator pass: host mode resolves into a deterministic run plan. Next implementation pass should persist host state in D1 and dispatch Queues, Workflows, and Durable Object locks.',
    });
  },
};
