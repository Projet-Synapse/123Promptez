// Edge Function: /functions/chat — proxy streaming vers les fournisseurs IA.
//  - Claude (Anthropic) : clé projet ou clé personnelle du client (body.apiKey)
//  - Gemini (Google AI Studio) : clé PERSONNELLE du client obligatoire
//    (niveau gratuit « Essai sans frais ») — le proxy est indispensable car
//    l'endpoint streaming de Google ne renvoie PAS les en-têtes CORS.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const { messages, model, maxTokens, apiKey, temperature } = await req.json();
    const personal = typeof apiKey === 'string' && apiKey.trim().length >= 10 ? apiKey.trim() : null;
    const systemMessage = (messages ?? []).find((m: any) => m.role === 'system')?.content ?? '';
    const convo = (messages ?? []).filter((m: any) => m.role !== 'system');
    if (convo.length === 0) throw new Error('Aucun message');
    const modelFinal = model || 'claude-sonnet-5';
    const maxTokensFinal = Math.min(Math.max(Math.round(maxTokens ?? 4096), 1), 32000);

    // Relais commun : transforme le flux SSE amont en événements {delta} homogènes.
    const relay = (apiRes: Response, extract: (ev: any) => string | null): Response => {
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        async start(ctrl) {
          const send = (o: any) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
          try {
            const reader = apiRes.body!.getReader();
            const dec = new TextDecoder();
            let buf = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              // Google sépare ses événements par \r\n\r\n : normaliser en \n
              // sinon le découpage ne se fait jamais et tout est jeté.
              buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
              const parts = buf.split('\n\n');
              buf = parts.pop() ?? '';
              for (const part of parts) {
                for (const line of part.split('\n')) {
                  if (!line.startsWith('data: ')) continue;
                  try {
                    const ev = JSON.parse(line.slice(6));
                    const delta = extract(ev);
                    if (delta) send({ delta });
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
    };

    // ── Gemini (Google AI Studio) — clé personnelle requise ──
    if (modelFinal.startsWith('gemini')) {
      if (!personal) {
        throw new Error('Aucune clé Gemini — colle ta clé Google AI Studio (gratuite, aistudio.google.com) dans Builder ▸ Paramètres ▸ Clé API');
      }
      const contents = convo.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelFinal)}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': personal },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemMessage }] },
            generationConfig: {
              maxOutputTokens: maxTokensFinal,
              ...(typeof temperature === 'number' ? { temperature } : {}),
            },
          }),
        },
      );
      if (!gRes.ok || !gRes.body) {
        const t = await gRes.text().catch(() => '');
        let msg = t.slice(0, 300);
        try { msg = JSON.parse(t)?.error?.message ?? msg; } catch { /* brut */ }
        throw new Error(`Gemini ${gRes.status}: ${msg}`);
      }
      return relay(gRes, (ev) => {
        if (ev.error) throw new Error(ev.error.message ?? 'Erreur Gemini');
        return (ev.candidates?.[0]?.content?.parts ?? [])
          .map((p: any) => p.text ?? '')
          .join('') || null;
      });
    }

    // ── Claude (Anthropic) — clé personnelle si fournie, sinon clé projet ──
    const apiKeyFinal = personal ?? Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKeyFinal) {
      throw new Error('Aucune clé API — colle ta clé Anthropic dans Builder ▸ Paramètres ▸ Clé API');
    }
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKeyFinal,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelFinal,
        max_tokens: maxTokensFinal,
        system: systemMessage,
        messages: convo,
        stream: true,
      }),
    });
    if (!apiRes.ok || !apiRes.body) {
      const t = await apiRes.text().catch(() => '');
      throw new Error(`Anthropic ${apiRes.status}: ${t.slice(0, 300)}`);
    }
    return relay(apiRes, (ev) =>
      ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' ? ev.delta.text : null,
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message ?? 'Erreur interne' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
