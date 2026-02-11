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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-esp32-secret');
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  /* ======================================================
     ESP32 POLL (GET)
     ====================================================== */
  if (req.method === 'GET') {
    const secret = process.env.ESP32_SECRET;
    const provided = req.headers['x-esp32-secret'] || req.query.secret;

    if (secret && provided !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cmdRaw = await redis("get", "pendingCommand");
    if (!cmdRaw.result) {
      return res.status(200).json({ command: "none" });
    }

    const cmd = JSON.parse(cmdRaw.result);

    // mark as delivered (not executed)
    cmd.state = "delivered";
    cmd.deliveredAt = Date.now();
    await redis("set", "pendingCommand", JSON.stringify(cmd));

    return res.status(200).json(cmd);
  }

  /* ======================================================
     POST
     ====================================================== */
  if (req.method === 'POST') {
    const body = req.body || {};

    /* ================= ACK ================= */
    if (body.type === "ack") {
      const raw = await redis("get", "pendingCommand");
      const pending = raw.result ? JSON.parse(raw.result) : null;

      if (!pending || pending.id !== body.id) {
        return res.status(409).json({ error: "Command mismatch" });
      }

      // only accept ack AFTER execution
      await redis("set", "lastAck", JSON.stringify({
        id: body.id,
        command: pending.command,
        result: body.result,           // ok | fail
        executedAt: body.executedAt,
        ackedAt: Date.now()
      }));

      if (body.result === "ok" && pending.command === "feed") {
        await redis("lpush", "feedHistory", JSON.stringify({
          time: new Date().toISOString(),
          source: body.source || "remote"
        }));
        await redis("ltrim", "feedHistory", 0, 19);
      }

      await redis("del", "pendingCommand");
      return res.status(200).json({ ok: true });
    }

    /* ================= STATUS PUSH ================= */
    if (body.type === "status") {
      await redis("set", "sensorData", JSON.stringify({
        temp: body.temp,
        ph: body.ph,
        tds: body.tds,
        feedCount: body.feedCount,
        lastFeed: body.lastFeed,
        servoOpen: body.servoOpen,
        updatedAt: Date.now()
      }));

      return res.status(200).json({ ok: true });
    }

    /* ================= WEBSITE QUEUE ================= */
    const { action, angle } = body;

    if (!["feed", "servo", "close"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    const newCmd = {
      id: makeId(),
      command: action,
      angle: angle ?? null,
      state: "queued",
      queuedAt: Date.now()
    };

    await redis("set", "pendingCommand", JSON.stringify(newCmd));

    return res.status(200).json({ ok: true, queued: newCmd });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
