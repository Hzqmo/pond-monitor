const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${UPSTASH_URL}/${command}/${args.join("/")}`, {
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
    },
  });
  return res.json();
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Fetch all data from Redis
    const sensor = await redis("get", "sensorData");
    const lastAck = await redis("get", "lastAck");
    const pending = await redis("get", "pendingCommand");
    const history = await redis("lrange", "feedHistory", 0, 19);

    // Parse sensor data
    const sensorData = sensor.result ? JSON.parse(sensor.result) : null;
    const lastAckData = lastAck.result ? JSON.parse(lastAck.result) : null;
    const pendingData = pending.result ? JSON.parse(pending.result) : null;
    const feedHistory = history.result
      ? history.result.map(item => JSON.parse(item))
      : [];

    // Calculate staleness
    const staleSec = sensorData
      ? Math.floor((Date.now() - sensorData.updatedAt) / 1000)
      : null;

    // Consider online if data is less than 90 seconds old
    const isOnline = staleSec !== null && staleSec < 90;

    // Build response
    const response = {
      online: isOnline,
      staleSec,
      sensor: sensorData,
      feedHistory,
      pendingCmd: pendingData,
      lastAck: lastAckData,
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Status API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch status',
      details: error.message 
    });
  }
}
