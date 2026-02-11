// api/tts.js - ElevenLabs Text-to-Speech API endpoint
// Deploy this file to your Vercel project in the /api folder

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid text parameter' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ 
          error: 'ELEVENLABS_API_KEY not configured. Add it to Vercel Environment Variables.' 
        }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // ElevenLabs Voice IDs for Malay/Indonesian voices
    // You can find more voices at: https://elevenlabs.io/voice-library
    // These are some good options for natural Malay speech:
    const VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam - multilingual, works well for Malay
    // Alternative voices you can try:
    // 'EXAVITQu4vr4xnSDxMaL' - Bella - female, multilingual
    // 'ErXwobaYiN019PkySvjV' - Antoni - male, multilingual
    // 'MF3mGyEYCl7XYWbV9V6O' - Elli - female, multilingual

    // Call ElevenLabs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2', // Best for non-English languages
          voice_settings: {
            stability: 0.5,        // 0.0-1.0: Higher = more consistent, lower = more expressive
            similarity_boost: 0.75, // 0.0-1.0: How closely to match the original voice
            style: 0.5,            // 0.0-1.0: Exaggeration of speaking style
            use_speaker_boost: true // Enhanced clarity
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      
      // Check if quota exceeded
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Invalid API key. Check your ELEVENLABS_API_KEY.' }),
          { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Quota exceeded. You have used your 10,000 free characters this month.' }),
          { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `ElevenLabs API error: ${response.status}` }),
        { status: response.status, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Return audio stream
    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('TTS API error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
}
