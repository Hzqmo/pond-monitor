/**
 * /api/chat
 *
 * POST { model, messages, max_tokens, temperature }
 *      → proxies to Groq, keeping the API key server-side
 *
 * This file is UNCHANGED from your original — the Groq key stays
 * safely in Vercel environment variables as GROQ_API_KEY.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'GROQ_API_KEY not set in Vercel environment variables' } });
  }

  try {
    const groqRes = await fetch(GROQ_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(req.body),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({ error: data.error ?? { message: 'Groq API error' } });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
