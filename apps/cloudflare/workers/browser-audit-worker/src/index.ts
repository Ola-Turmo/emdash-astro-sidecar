export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const target = url.searchParams.get('target');

    if (!target) {
      return Response.json(
        {
          ok: false,
          error: 'Missing ?target=<url>',
        },
        { status: 400 },
      );
    }

    return Response.json({
      ok: true,
      target,
      note: 'Scaffold browser audit worker only. Next implementation pass should integrate Browser Rendering screenshots and DOM checks.',
    });
  },
};
