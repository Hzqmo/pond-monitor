/**
 * /api/status
 *
 * GET  → returns latest sensor data pushed by ESP32 + pending command info
 *
 * The ESP32 pushes its sensor readings to /api/command every 30 s.
 * This endpoint lets the website read that cached data without
 * needing to talk to the ESP32 directly.
 */

if (!global._pondStore) {
  global._pondStore = {
    pendingCommand: null,
    lastAck:        null,
    sensorData:     null,
    feedHistory:    [],
  };
}
const store = global._pondStore;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sensor    = store.sensorData;
  const lastAck   = store.lastAck;
  const pending   = store.pendingCommand;

  // How stale is the sensor data?
  const staleSec  = sensor ? Math.floor((Date.now() - sensor.updatedAt) / 1000) : null;
  const isOnline  = staleSec !== null && staleSec < 90;   // offline if no push for 90 s

  return res.status(200).json({
    online:       isOnline,
    staleSec,
    sensor:       sensor ?? null,
    feedHistory:  store.feedHistory,
    pendingCmd:   pending ? { action: pending.action, id: pending.id, queuedAt: pending.queuedAt } : null,
    lastAck:      lastAck ?? null,
  });
}
