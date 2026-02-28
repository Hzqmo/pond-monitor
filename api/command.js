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
     ESP32 POLL (GET) — Arduino calls this every 15s
     Returns { command, id, ageMs } or { command: "none" }
     ====================================================== */
  if (req.method === 'GET') {
    const secret   = process.env.ESP32_SECRET;
    const provided = req.headers['x-esp32-secret'] || req.query.secret;

    if (secret && provided !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cmdRaw = await redis("get", "pendingCommand");

    if (!cmdRaw.result) {
      return res.status(200).json({ command: "none" });
    }

    const cmd = JSON.parse(cmdRaw.result);

    // Calculate age so Arduino can ignore stale commands (>60s)
    const ageMs = Date.now() - (cmd.queuedAt || 0);

    // Mark as delivered
    cmd.state       = "delivered";
    cmd.deliveredAt = Date.now();
    await redis("set", "pendingCommand", JSON.stringify(cmd));

    return res.status(200).json({
      id:      cmd.id,
      command: cmd.command,
      ageMs,
    });
  }

  /* ======================================================
     POST — handles 3 sources:
       1. ESP32 status push  (body.type === "status")
       2. ESP32 ack          (body.type === "ack")
       3. Dashboard command  (body.action === "feed"|"close"|"reset")
     ====================================================== */
  if (req.method === 'POST') {
    const body = req.body || {};

    /* ── 1. ESP32 STATUS PUSH ─────────────────────────── */
    if (body.type === "status") {
      const existingRaw = await redis("get", "sensorData");
      const existing    = existingRaw.result ? JSON.parse(existingRaw.result) : null;

      // Preserve highest feedCount seen (guards against reboot resets)
      const feedCount = Math.max(
        body.feedCount ?? 0,
        existing?.feedCount ?? 0
      );

      // Preserve last known feed time if ESP32 sends "Belum lagi"
      const lastFeed = (body.lastFeed && body.lastFeed !== "Belum lagi")
        ? body.lastFeed
        : (existing?.lastFeed || "Belum lagi");

      await redis("set", "sensorData", JSON.stringify({
        temp:        body.temp        ?? existing?.temp        ?? 0,
        tds:         body.tds         ?? existing?.tds         ?? -1,  // -1 = init
        feedCount,
        lastFeed,
        motorActive: body.motorActive ?? false,
        cycle:       body.cycle       ?? 0,
        uptime:      body.uptime      ?? 0,
        updatedAt:   Date.now()
      }));

      return res.status(200).json({ ok: true });
    }

    /* ── 2. ESP32 ACK ─────────────────────────────────── */
    if (body.type === "ack") {
      const raw     = await redis("get", "pendingCommand");
      const pending = raw.result ? JSON.parse(raw.result) : null;

      if (!pending || pending.id !== body.id) {
        // Mismatch — still store the ack so dashboard can detect it
        await redis("set", "lastAck", JSON.stringify({
          id:         body.id,
          command:    body.command || "unknown",
          result:     body.result,
          source:     body.source || "remote",
          executedAt: body.executedAt,
          ackedAt:    Date.now()
        }));
        return res.status(200).json({ ok: true, warning: "Command mismatch — ack stored anyway" });
      }

      await redis("set", "lastAck", JSON.stringify({
        id:         body.id,
        command:    pending.command,
        result:     body.result,
        source:     body.source || "remote",
        executedAt: body.executedAt,
        ackedAt:    Date.now()
      }));

      // Append to feed history on successful feed
      if (body.result === "ok" && pending.command === "feed") {
        await redis("lpush", "feedHistory", JSON.stringify({
          time:   new Date().toISOString(),
          source: body.source || "remote"
        }));
        await redis("ltrim", "feedHistory", 0, 19);
      }

      // On confirmed reset — wipe Redis feed data too
      if (body.result === "ok" && pending.command === "reset") {
        await redis("del", "feedHistory");
        await redis("set", "sensorData", JSON.stringify({
          temp:        0,
          tds:         -1,
          feedCount:   0,
          lastFeed:    "Belum lagi",
          motorActive: false,
          cycle:       0,
          uptime:      0,
          updatedAt:   Date.now()
        }));
      }

      await redis("del", "pendingCommand");
      return res.status(200).json({ ok: true });
    }

    /* ── 3. DASHBOARD COMMAND QUEUE ───────────────────── */
    const { action } = body;

    // "servo" removed — Arduino uses DC motor, no servo
    if (!["feed", "close", "reset"].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Valid: feed, close, reset" });
    }

    const newCmd = {
      id:       makeId(),
      command:  action,
      state:    "queued",
      queuedAt: Date.now()
    };

    await redis("set", "pendingCommand", JSON.stringify(newCmd));

    return res.status(200).json({ ok: true, queued: newCmd });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
