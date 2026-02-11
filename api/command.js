/**
 * /api/command
 *
 * POST  { action: "feed" | "servo", angle?: number }
 *        → called by the website to queue a command
 *
 * GET   ?secret=ESP32_SECRET
 *        → called by ESP32 to poll for a pending command
 *        → returns { command: "feed"|"servo"|"none", angle?: number, id: string }
 *
 * POST  { type: "ack", id: string, result: "ok"|"error" }
 *        → called by ESP32 after executing a command
 *
 * POST  { type: "status", temp, ph, tds, feedCount, lastFeed, servoOpen }
 *        → called by ESP32 every 30 s to push live sensor data
 *
 * Storage: Vercel Edge Config is overkill here — we use a simple
 *          in-memory singleton that survives within one serverless
 *          function instance.  For production you'd swap this for
 *          KV / Upstash Redis, but for a home pond monitor this is
 *          perfectly fine.
 */

// ── In-memory store (persists for the lifetime of one warm Lambda) ──
// Vercel re-uses warm instances for ~5 min, which is enough for the
// ESP32 to pick up commands quickly.  We also write to a global so
// /api/status can read it from the same instance.

if (!global._pondStore) {
  global._pondStore = {
    pendingCommand: null,   // { id, action, angle, queuedAt }
    lastAck:        null,   // { id, result, ackedAt }
    sensorData:     null,   // latest push from ESP32
    feedHistory:    [],     // last 20 feed events
  };
}
const store = global._pondStore;

// Simple ID generator
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// CORS headers – allow your GitHub Pages / Vercel frontend
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-esp32-secret');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── ESP32 polls for commands ──────────────────────────────────────
  if (req.method === 'GET') {
    // Optional simple secret check so random internet traffic can't
    // drain the command queue.  Set ESP32_SECRET in Vercel env vars.
    const secret = process.env.ESP32_SECRET;
    if (secret) {
      const provided = req.headers['x-esp32-secret'] || req.query.secret;
      if (provided !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    if (store.pendingCommand) {
      const cmd = store.pendingCommand;
      // Don't clear yet — wait for ACK
      return res.status(200).json({
        command:  cmd.action,   // "feed" | "servo"
        angle:    cmd.angle ?? null,
        id:       cmd.id,
        queuedAt: cmd.queuedAt,
      });
    }

    return res.status(200).json({ command: 'none' });
  }

  // ── POST handler ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body || {};

    // ── ACK from ESP32 ─────────────────────────────────────────────
    if (body.type === 'ack') {
      if (store.pendingCommand && store.pendingCommand.id === body.id) {
        store.lastAck = {
          id:      body.id,
          result:  body.result,   // "ok" | "error"
          ackedAt: Date.now(),
        };

        // Record successful feed in history
        if (body.result === 'ok' && store.pendingCommand.action === 'feed') {
          store.feedHistory.unshift({
            time:   new Date().toISOString(),
            source: body.source || 'remote',
          });
          if (store.feedHistory.length > 20) store.feedHistory.pop();
        }

        store.pendingCommand = null;   // clear queue
      }
      return res.status(200).json({ ok: true });
    }

    // ── Sensor status push from ESP32 ──────────────────────────────
    if (body.type === 'status') {
      store.sensorData = {
        temp:       body.temp,
        ph:         body.ph,
        tds:        body.tds,
        feedCount:  body.feedCount,
        lastFeed:   body.lastFeed,
        servoOpen:  body.servoOpen,
        updatedAt:  Date.now(),
      };
      return res.status(200).json({ ok: true });
    }

    // ── Website queues a command ───────────────────────────────────
    const { action, angle } = body;

    if (!action || !['feed', 'servo', 'close'].includes(action)) {
      return res.status(400).json({ error: 'action must be feed | servo | close' });
    }
    if (action === 'servo' && (angle === undefined || angle < 0 || angle > 180)) {
      return res.status(400).json({ error: 'angle must be 0-180 for servo action' });
    }

    // Overwrite any stale pending command
    store.pendingCommand = {
      id:       makeId(),
      action,
      angle:    angle ?? null,
      queuedAt: Date.now(),
    };

    return res.status(200).json({
      ok:      true,
      queued:  store.pendingCommand,
      message: 'Command queued — ESP32 will pick it up within 3 s',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
