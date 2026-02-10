export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS headers that work with Vercel Edge
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: { message: 'GROQ_API_KEY not configured in Vercel environment variables' }
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Extract messages
    const messagesToSend = body.messages || [];

    if (!messagesToSend.length) {
      return new Response(JSON.stringify({ 
        error: { message: 'No messages provided' }
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.model || 'llama-3.3-70b-versatile',
        messages: messagesToSend,
        max_tokens: body.max_tokens || 300,
        temperature: body.temperature || 0.7,
      }),
    });

    const data = await groqResponse.json();

    // If Groq returned an error
    if (!groqResponse.ok) {
      return new Response(JSON.stringify({ 
        error: data.error || { message: 'Groq API error' }
      }), {
        status: groqResponse.status,
        headers: corsHeaders
      });
    }

    // Return successful response
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      error: { message: error.message || 'Internal server error' }
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
