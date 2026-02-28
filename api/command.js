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

// Feed parameter limits — prevents accidental abuse
const FEED_LIMITS = {
  cycles:  { min: 1,    max: 30,    default: 15    },
  runMs:   { min: 2000, max: 30000, default: 10000 },
  pauseMs: { min: 1000, max: 10000, default: 3000  },
};

function clamp(val, min, max, def) {
  const n = parseInt(val);
  if (isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  /* ======================================================
     ESP32 POLL (GET) — Arduino polls every 15s
     Returns { command, id, ageMs, cycles, runMs, pauseMs }
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

    const cmd   = JSON.parse(cmdRaw.result);
    const ageMs = Date.now() - (cmd.queuedAt || 0);

    cmd.state       = "delivered";
    cmd.deliveredAt = Date.now();
    await redis("set", "pendingCommand", JSON.stringify(cmd));

    return res.status(200).json({
      id:      cmd.id,
      command: cmd.command,
      ageMs,
      // Feed params — ESP32 uses these instead of hardcoded #defines
      // Defaults are sent for every command so ESP32 always has valid values
      cycles:  cmd.cycles  ?? FEED_LIMITS.cycles.default,
      runMs:   cmd.runMs   ?? FEED_LIMITS.runMs.default,
      pauseMs: cmd.pauseMs ?? FEED_LIMITS.pauseMs.default,
    });
  }

  /* ======================================================
     POST — 3 sources:
       1. ESP32 status push  (body.type === "status")
       2. ESP32 ack          (body.type === "ack")
       3. Dashboard command  (body.action)
     ====================================================== */
  if (req.method === 'POST') {
    const body = req.body || {};

    /* ── 1. ESP32 STATUS PUSH ─────────────────────────── */
    if (body.type === "status") {
      const existingRaw = await redis("get", "sensorData");
      const existing    = existingRaw.result ? JSON.parse(existingRaw.result) : null;

      const feedCount = Math.max(
        body.feedCount ?? 0,
        existing?.feedCount ?? 0
      );

      const lastFeed = (body.lastFeed && body.lastFeed !== "Belum lagi")
        ? body.lastFeed
        : (existing?.lastFeed || "Belum lagi");

      await redis("set", "sensorData", JSON.stringify({
        temp:        body.temp        ?? existing?.temp ?? 0,
        tds:         body.tds         ?? existing?.tds  ?? -1,
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

      // Store ack regardless of id match so dashboard polling always detects it
      await redis("set", "lastAck", JSON.stringify({
        id:         body.id,
        command:    pending?.command || "unknown",
        result:     body.result,
        source:     body.source || "remote",
        executedAt: body.executedAt,
        ackedAt:    Date.now()
      }));

      if (pending && pending.id === body.id) {
        // Append feed to history including the params that were actually used
        if (body.result === "ok" && pending.command === "feed") {
          await redis("lpush", "feedHistory", JSON.stringify({
            time:    new Date().toISOString(),
            source:  body.source || "remote",
            cycles:  pending.cycles  ?? FEED_LIMITS.cycles.default,
            runMs:   pending.runMs   ?? FEED_LIMITS.runMs.default,
            pauseMs: pending.pauseMs ?? FEED_LIMITS.pauseMs.default,
          }));
          await redis("ltrim", "feedHistory", 0, 19);
        }

        // On confirmed reset — wipe Redis to match ESP32 NVS wipe
        if (body.result === "ok" && pending.command === "reset") {
          await redis("del", "feedHistory");
          await redis("set", "sensorData", JSON.stringify({
            temp: 0, tds: -1, feedCount: 0, lastFeed: "Belum lagi",
            motorActive: false, cycle: 0, uptime: 0, updatedAt: Date.now()
          }));
        }

        await redis("del", "pendingCommand");
      }

      return res.status(200).json({ ok: true });
    }

    /* ── 3. DASHBOARD COMMAND QUEUE ───────────────────── */
    const { action, cycles, runMs, pauseMs } = body;

    if (!["feed", "close", "reset"].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Valid: feed, close, reset" });
    }

    const newCmd = {
      id:       makeId(),
      command:  action,
      state:    "queued",
      queuedAt: Date.now(),
    };

    // Only attach feed params for "feed" command
    if (action === "feed") {
      newCmd.cycles  = clamp(cycles,  FEED_LIMITS.cycles.min,  FEED_LIMITS.cycles.max,  FEED_LIMITS.cycles.default);
      newCmd.runMs   = clamp(runMs,   FEED_LIMITS.runMs.min,   FEED_LIMITS.runMs.max,   FEED_LIMITS.runMs.default);
      newCmd.pauseMs = clamp(pauseMs, FEED_LIMITS.pauseMs.min, FEED_LIMITS.pauseMs.max, FEED_LIMITS.pauseMs.default);
    }

    await redis("set", "pendingCommand", JSON.stringify(newCmd));
    return res.status(200).json({ ok: true, queued: newCmd });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
