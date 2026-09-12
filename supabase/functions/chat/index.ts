// Edge Function: /functions/chat — proxy streaming vers Anthropic Claude.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const { messages, model, maxTokens } = await req.json();
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY manquante');
    const systemMessage = (messages ?? []).find((m: any) => m.role === 'system')?.content ?? '';
    const convo = (messages ?? []).filter((m: any) => m.role !== 'system');
    if (convo.length === 0) throw new Error('Aucun message');
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-5',
        max_tokens: Math.min(Math.max(Math.round(maxTokens ?? 4096), 1), 32000),
        system: systemMessage,
        messages: convo,
        stream: true,
      }),
    });
    if (!apiRes.ok || !apiRes.body) {
      const t = await apiRes.text().catch(() => '');
      throw new Error(`Anthropic ${apiRes.status}: ${t.slice(0, 300)}`);
    }
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(ctrl) {
        const send = (o: any) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        try {
          const reader = apiRes.body.getReader();
          const dec = new TextDecoder();
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const parts = buf.split('\n\n');
            buf = parts.pop() ?? '';
            for (const part of parts) {
              for (const line of part.split('\n')) {
                if (!line.startsWith('data: ')) continue;
                try {
                  const ev = JSON.parse(line.slice(6));
                  if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
                    send({ delta: ev.delta.text });
                  }
                } catch { /* ignore */ }
              }
            }
          }
          send({ done: true });
        } catch (e: any) {
          send({ error: e.message ?? 'Stream failed' });
        } finally {
          ctrl.close();
        }
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message ?? 'Erreur interne' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
