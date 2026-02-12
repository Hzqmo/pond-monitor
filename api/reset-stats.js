const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${UPSTASH_URL}/${command}/${args.join("/")}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  return res.json();
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Require confirmation to prevent accidental resets
  if (!req.body || !req.body.confirm) {
    return res.status(400).json({ 
      error: 'Confirmation required',
      message: 'Send { "confirm": true } in request body'
    });
  }
  
  try {
    // Reset sensor data with zeroed feed stats
    await redis("set", "sensorData", JSON.stringify({
      temp: 0,
      ph: 0,
      tds: 0,
      feedCount: 0,
      lastFeed: "Belum lagi",
      servoOpen: false,
      updatedAt: Date.now()
    }));
    
    // Clear feed history
    await redis("del", "feedHistory");
    
    // Clear any pending commands
    await redis("del", "pendingCommand");
    
    // Clear last ACK
    await redis("del", "lastAck");
    
    console.log('✅ Feed stats reset successfully');
    
    return res.status(200).json({ 
      ok: true, 
      message: 'All feed stats have been reset. Restart ESP32 to clear its NVS memory.' 
    });
    
  } catch (error) {
    console.error('❌ Reset error:', error);
    return res.status(500).json({ 
      error: 'Reset failed',
      details: error.message 
    });
  }
}
