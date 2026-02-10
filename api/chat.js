// api/chat.js
export const config = {
  runtime: 'edge', // This makes it run fast like Cloudflare
};

export default async function handler(req) {
  // 1. Handle CORS (Allow your frontend to talk to this)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    
    // Get the API Key safely from Vercel Environment Variables
    const apiKey = process.env.GROQ_API_KEY; 

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error: No API Key' }), { status: 500 });
    }

    // 2. Prepare messages (Keep your logic)
    let messagesToSend = [];
    if (body.messages) {
      messagesToSend = body.messages;
    } else if (body.contents) {
      const text = body.contents[0]?.parts[0]?.text || "";
      messagesToSend = [{ role: "user", content: text }];
    }

    // 3. Forward to Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: messagesToSend,
        max_tokens: 300,
      }),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
