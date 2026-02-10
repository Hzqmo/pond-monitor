export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Define CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Handle non-POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Handle POST request
  try {
    const body = await req.json();
    const apiKey = process.env.GROQ_API_KEY;

    // Check if API key exists
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'GROQ_API_KEY not configured. Add it in Vercel Environment Variables.',
          },
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Extract messages from request
    const messages = body.messages || [];

    if (!messages.length) {
      return new Response(
        JSON.stringify({
          error: { message: 'No messages provided in request' },
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Call Groq API
    const groqResponse = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: body.model || 'llama-3.3-70b-versatile',
          messages: messages,
          max_tokens: body.max_tokens || 300,
          temperature: body.temperature || 0.7,
        }),
      }
    );

    const data = await groqResponse.json();

    // Check if Groq API returned an error
    if (!groqResponse.ok) {
      return new Response(
        JSON.stringify({
          error: data.error || { message: 'Groq API request failed' },
        }),
        {
          status: groqResponse.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Return successful response
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Server error:', error);
    return new Response(
      JSON.stringify({
        error: { message: error.message || 'Internal server error' },
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
