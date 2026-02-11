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

  const sensor = await redis("get", "sensorData");
  const lastAck = await redis("get", "lastAck");
  const pending = await redis("get", "pendingCommand");
  const history = await redis("lrange", "feedHistory", 0, 19);

  const sensorData = sensor.result ? JSON.parse(sensor.result) : null;
  const lastAckData = lastAck.result ? JSON.parse(lastAck.result) : null;
  const pendingData = pending.result ? JSON.parse(pending.result) : null;
  const feedHistory = history.result
    ? history.result.map(item => JSON.parse(item))
    : [];

  const staleSec = sensorData
    ? Math.floor((Date.now() - sensorData.updatedAt) / 1000)
    : null;

  const isOnline = staleSec !== null && staleSec < 90;

  return res.status(200).json({
    online: isOnline,
    staleSec,
    sensor: sensorData,
    feedHistory,
    pendingCmd: pendingData,
    lastAck: lastAckData
  });
}
