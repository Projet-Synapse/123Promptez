/** Run: npx tsx scripts/test-local-ai.ts (no server, network or API key). */
import assert from 'node:assert/strict';
import { DEFAULT_LOCAL_AI, listLocalModels, localBaseUrl, localCompletion } from '../services/localAI';

async function main() {
  const config = { ...DEFAULT_LOCAL_AI, enabled: true, narrativeModel: 'story', memoryModel: 'memory' };
  const oldFetch = globalThis.fetch;
  const calls: { url: string; body: any }[] = [];
  const mock = (response: () => any) => {
    globalThis.fetch = (async (url: any, init?: any) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
      return response();
    }) as typeof fetch;
  };
  const opts = { config, purpose: 'narrative' as const, messages: [{ role: 'user', content: 'Bonjour' }] };
  try {
    assert.equal(localBaseUrl({ ...config, url: 'http://192.168.1.20:1234/v1/' }), 'http://192.168.1.20:1234');
    assert.throws(() => localBaseUrl({ ...config, url: 'file:///tmp/local' }));
    mock(() => new Response(JSON.stringify({ models: [{ name: 'story' }, { name: 'memory' }] })));
    assert.deepEqual(await listLocalModels(config), ['story', 'memory']);
    assert.ok(calls.at(-1)!.url.endsWith('/api/tags'));
    // NDJSON stream with split multibyte text and no final newline.
    const bytes = new TextEncoder().encode('{"message":{"content":"Été "}}\n{"message":{"content":"ici"},"done":true}');
    mock(() => new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 26)); c.enqueue(bytes.slice(26)); c.close(); } })));
    const tokens: string[] = [];
    assert.equal(await localCompletion({ ...opts, onToken: s => tokens.push(s) }), 'Été ici');
    assert.equal(tokens.at(-1), 'Été ici');
    assert.equal(calls.at(-1)!.body.stream, true);
    assert.ok(calls.at(-1)!.url.endsWith('/api/chat'));
    // Android must request regular JSON, not try to parse raw NDJSON as JSON.
    mock(() => new Response(JSON.stringify({ message: { content: '{"characters":[]}' } })));
    assert.equal(await localCompletion({ ...opts, purpose: 'memory', json: true, android: true }), '{"characters":[]}');
    assert.equal(calls.at(-1)!.body.stream, false);
    assert.equal(calls.at(-1)!.body.format, 'json');
    assert.equal(calls.at(-1)!.body.model, 'memory');
    // Browser without getReader: buffered NDJSON still decoded, no Supabase.
    mock(() => ({ ok: true, body: null, text: async () => '{"message":{"content":"OK"},"done":true}' }));
    assert.equal(await localCompletion(opts), 'OK');
    const openai = { ...config, protocol: 'openai' as const, url: 'http://localhost:1234/v1' };
    mock(() => new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\r\n\r\ndata: [DONE]\n'));
    assert.equal(await localCompletion({ ...opts, config: openai }), 'Hello');
    assert.equal(calls.at(-1)!.url, 'http://localhost:1234/v1/chat/completions');
    mock(() => new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] })));
    assert.equal(await localCompletion({ ...opts, config: openai, purpose: 'memory', json: true, android: true }), '{}');
    assert.equal(calls.at(-1)!.body.response_format.type, 'json_object');
    mock(() => new Response('oops', { status: 500 }));
    await assert.rejects(localCompletion(opts), /HTTP 500/);
    assert.ok(calls.every(c => !c.url.includes('supabase')));
    console.log('PASS: tags, URL validation, NDJSON, SSE, Android non-stream, JSON mode, independent models, HTTP errors, direct calls.');
  } finally { globalThis.fetch = oldFetch; }
}
void main();
