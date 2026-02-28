const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(command, ...args) {
  const res = await fetch(`${UPSTASH_URL}/${command}/${args.join("/")}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
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

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [sensorRaw, lastAckRaw, pendingRaw, historyRaw] = await Promise.all([
      redis("get",    "sensorData"),
      redis("get",    "lastAck"),
      redis("get",    "pendingCommand"),
      redis("lrange", "feedHistory", 0, 19),
    ]);

    const sensorData  = sensorRaw.result   ? JSON.parse(sensorRaw.result)   : null;
    const lastAckData = lastAckRaw.result  ? JSON.parse(lastAckRaw.result)  : null;
    const pendingData = pendingRaw.result  ? JSON.parse(pendingRaw.result)  : null;
    const feedHistory = historyRaw.result  ? historyRaw.result.map(i => JSON.parse(i)) : [];

    const staleSec = sensorData
      ? Math.floor((Date.now() - sensorData.updatedAt) / 1000)
      : null;

    // ESP32 considered online if data arrived within 20s
    // (ESP32 pushes every 30s, so 20s = fresh data)
    const isOnline = staleSec !== null && staleSec < 20;

    return res.status(200).json({
      online:  isOnline,
      staleSec,
      sensor: sensorData ? {
        temp:        sensorData.temp,
        tds:         sensorData.tds,         // -1 means still initialising (buffer not full)
        feedCount:   sensorData.feedCount,
        lastFeed:    sensorData.lastFeed,
        motorActive: sensorData.motorActive, // true if running OR pausing between cycles
        cycle:       sensorData.cycle,       // motorCycleCount (0–15)
        uptime:      sensorData.uptime,      // seconds since ESP32 boot
      } : null,
      feedHistory,
      pendingCmd: pendingData,
      lastAck:    lastAckData,
      timestamp:  new Date().toISOString(),
    });

  } catch (error) {
    console.error('Status API error:', error);
    return res.status(500).json({ error: 'Failed to fetch status', details: error.message });
  }
}
