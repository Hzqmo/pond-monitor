export const config = {
  runtime: 'edge',
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req) {
  // ── Preflight ──────────────────────────────────────────────────
  // Must be the VERY FIRST thing — before any await / JSON parsing
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // ── Only allow POST ────────────────────────────────────────────
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  // ── Parse body ─────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid JSON body' } }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  // ── Env check ──────────────────────────────────────────────────
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'GROQ_API_KEY not set in Vercel Environment Variables.' } }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const messages = body.messages || [];
  if (!messages.length) {
    return new Response(
      JSON.stringify({ error: { message: 'No messages provided.' } }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  // ── Call Groq ──────────────────────────────────────────────────
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       body.model       || 'llama-3.3-70b-versatile',
        messages,
        max_tokens:  body.max_tokens  || 300,
        temperature: body.temperature || 0.7,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return new Response(
        JSON.stringify({ error: data.error || { message: 'Groq API error' } }),
        { status: groqRes.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: err.message || 'Internal server error' } }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
}
