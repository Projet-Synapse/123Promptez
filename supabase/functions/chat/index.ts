// Edge Function: /functions/chat — proxies chat messages to Anthropic Claude
// via the official Anthropic TypeScript SDK, with streaming.
//
// Requires the ANTHROPIC_API_KEY secret to be set on this Supabase project:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import Anthropic from 'npm:@anthropic-ai/sdk@^0.60.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Keep in sync with constants/config.ts LLM_MODELS on the client.
const SUPPORTED_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const DEFAULT_MODEL = 'claude-sonnet-5';

// Adaptive thinking is supported on Opus 5 / Sonnet 5 but not on the older
// Haiku 4.5 tier.
function supportsAdaptiveThinking(model: string): boolean {
  return model !== 'claude-haiku-4-5';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model, temperature, maxTokens, topP } = await req.json();

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured. Set ANTHROPIC_API_KEY as a Supabase Edge Function secret.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const requestedModel = SUPPORTED_MODELS.has(model) ? model : DEFAULT_MODEL;

    // Anthropic takes a single top-level `system` string and alternating
    // user/assistant turns — split the incoming OpenAI-style message list.
    const systemMessage = (messages ?? []).find((m: any) => m.role === 'system')?.content ?? '';
    const conversationMessages = (messages ?? [])
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({ role: m.role, content: m.content }));

    if (conversationMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No user/assistant messages provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sampling params (temperature/top_p) at non-default values are rejected
    // on Opus 5 / Sonnet 5 — only forward them for the Haiku 4.5 tier.
    const samplingParams = requestedModel === 'claude-haiku-4-5'
      ? { temperature: temperature ?? 1, top_p: topP ?? 1 }
      : {};

    const stream = anthropic.messages.stream({
      model: requestedModel,
      max_tokens: Math.min(Math.max(Math.round(maxTokens ?? 4096), 1), 8192),
      system: systemMessage,
      messages: conversationMessages,
      ...(supportsAdaptiveThinking(requestedModel) ? { thinking: { type: 'adaptive' } } : {}),
      ...samplingParams,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const payload = JSON.stringify({ delta: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (streamError: any) {
          console.error('[chat] Stream error:', streamError);
          const payload = JSON.stringify({ error: streamError?.message ?? 'Stream failed' });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    console.error('[chat] Unexpected error:', e);
    return new Response(
      JSON.stringify({ error: e?.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
