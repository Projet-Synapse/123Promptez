// Powered by OnSpace.AI
// Edge Function: /functions/chat — proxies chat messages to OnSpace AI (streaming)
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, model, temperature, maxTokens, topP } = await req.json();

    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      return new Response(
        JSON.stringify({ error: 'OnSpace AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'google/gemini-3-flash-preview',
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 2048,
        top_p: topP ?? 0.9,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[chat] OnSpace AI error:', errText);
      return new Response(
        JSON.stringify({ error: `OnSpace AI: ${errText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Stream the response back to client
    return new Response(response.body, {
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
      JSON.stringify({ error: e.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
