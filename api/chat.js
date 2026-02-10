export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // --- CORS HEADERS ---
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // 1. Handle Preflight (The Handshake)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // 2. Allow only POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing API Key configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Prepare messages
    let messagesToSend = [];
    if (body.messages) {
      messagesToSend = body.messages;
    } else if (body.contents) {
      const text = body.contents[0]?.parts[0]?.text || "";
      messagesToSend = [{ role: "user", content: text }];
    }

    // 4. Send to Groq
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
    
    // 5. Return success with CORS headers
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // 6. Return error with CORS headers
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
