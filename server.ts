import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// DATA_DIR is configurable so Docker can mount a persistent volume at /data
const DATA_DIR = process.env.DATA_DIR || process.cwd();
const DATA_FILE = path.join(DATA_DIR, 'data.json');

app.use(express.json());

// In-memory state
let state: Record<string, unknown> = {};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load initial state from file
if (fs.existsSync(DATA_FILE)) {
  try {
    state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    console.log(`State loaded from ${DATA_FILE}`);
  } catch (e) {
    console.error('Failed to parse data.json:', e);
  }
}

// Password is injected via environment variable — never hardcoded
const EDIT_PASSWORD = process.env.EDIT_PASSWORD || 'cup2024';

// Session tokens (in-memory; cleared on server restart — admin re-logs in)
const validTokens = new Set<string>();

// Connected SSE clients for real-time broadcast
const sseClients = new Set<express.Response>();

function broadcastState() {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ── REST: get current state ──────────────────────────────────────────────────
app.get('/api/state', (_req, res) => {
  res.json(state);
});

// ── SSE: real-time state stream ──────────────────────────────────────────────
app.get('/api/state/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx response buffering

  // Push current state immediately on connect
  res.write(`data: ${JSON.stringify(state)}\n\n`);

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// ── Auth: login ──────────────────────────────────────────────────────────────
app.post('/api/auth', (req, res) => {
  const { password } = req.body as { password?: string };
  if (password === EDIT_PASSWORD) {
    const token = randomUUID();
    validTokens.add(token);
    res.json({ success: true, token });
  } else {
    res.status(403).json({ error: 'Invalid password' });
  }
});

// ── Auth: logout ─────────────────────────────────────────────────────────────
app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body as { token?: string };
  if (token) validTokens.delete(token);
  res.json({ success: true });
});

// ── Save state (token-authenticated) ─────────────────────────────────────────
app.post('/api/state', (req, res) => {
  const { token, newState } = req.body as { token?: string; newState?: unknown };

  if (!token || !validTokens.has(token)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  state = newState as Record<string, unknown>;

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Failed to write state:', e);
    return res.status(500).json({ error: 'Failed to persist state' });
  }

  broadcastState();
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
