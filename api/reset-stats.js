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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!req.body?.confirm) {
    return res.status(400).json({ error: 'Send { "confirm": true }' });
  }

  try {
    // Queue "reset" command — ESP32 will:
    //   1. Clear its own NVS (feedCount, lastFeed)
    //   2. Send ack back
    //   3. command.js ack handler will then wipe Redis feedHistory + sensorData
    const newCmd = {
      id:       makeId(),
      command:  "reset",
      state:    "queued",
      queuedAt: Date.now()
    };

    await redis("set", "pendingCommand", JSON.stringify(newCmd));

    return res.status(200).json({
      ok:      true,
      queued:  newCmd,
      message: 'Reset command queued. ESP32 will clear NVS on next poll (≤15s).'
    });

  } catch (error) {
    console.error('Reset-stats error:', error);
    return res.status(500).json({ error: 'Failed to queue reset', details: error.message });
  }
}
