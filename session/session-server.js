const fs = require('fs');
const path = require('path');
const express = require('express');
const pino = require('pino');
const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  delay
} = require('@whiskeysockets/baileys');

const settings = require('../setting');
const logger = require('../utils/logger');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sessionRoot = path.join(__dirname, 'auth_info_baileys');
const credsPath = path.join(sessionRoot, 'creds.json');
const statusPath = path.join(__dirname, '..', 'session_status.json');

let pairingCode = null;
let socketReady = false;

function writeStatus(update) {
  let current = {};
  if (fs.existsSync(statusPath)) {
    try {
      current = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
    } catch {
      current = {};
    }
  }
  fs.writeFileSync(statusPath, JSON.stringify({ ...current, ...update }, null, 2));
}

async function buildSocket(phoneNumber) {
  fs.mkdirSync(sessionRoot, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(sessionRoot);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['KLAUS Session', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      socketReady = true;
      logger.session('Session linked successfully.');
    }
  });

  await delay(1000);
  pairingCode = await sock.requestPairingCode(phoneNumber);
  logger.session(`Pairing code generated for ${phoneNumber}`);

  writeStatus({
    generatedAt: new Date().toISOString(),
    lastPairingCode: pairingCode
  });

  return sock;
}

async function exportSessionBase64() {
  if (!fs.existsSync(credsPath)) return null;
  const raw = fs.readFileSync(credsPath, 'utf-8');
  const base64 = Buffer.from(raw, 'utf-8').toString('base64');
  writeStatus({
    lastSessionLength: base64.length
  });
  return base64;
}

app.get('/', (_, res) => {
  res.send(`
    <html>
      <body style="font-family:Segoe UI;padding:20px;max-width:540px;margin:auto;">
        <h2>${settings.BOT_NAME} Session Generator</h2>
        <form method="POST" action="/generate">
          <label>WhatsApp Number (with country code)</label><br/>
          <input name="number" placeholder="234xxxxxxxxxx" style="width:100%;padding:10px;margin:10px 0"/>
          <button type="submit" style="padding:10px 16px">Generate Pairing Code</button>
        </form>
        <p>After linking on phone, open <code>/export</code> to copy SESSION string.</p>
      </body>
    </html>
  `);
});

app.post('/generate', async (req, res) => {
  const number = String(req.body.number || '').replace(/[^0-9]/g, '');
  if (!number) {
    res.status(400).json({ ok: false, error: 'Valid phone number is required.' });
    return;
  }

  try {
    await buildSocket(number);
    res.json({
      ok: true,
      pairingCode,
      info: 'Open WhatsApp > Linked devices > Link with phone number and use code.'
    });
  } catch (err) {
    logger.error(`Session generation failed: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/status', async (_, res) => {
  const base64 = await exportSessionBase64();
  res.json({
    ok: true,
    linked: socketReady,
    pairingCode,
    hasSession: Boolean(base64)
  });
});

app.get('/export', async (_, res) => {
  const base64 = await exportSessionBase64();
  if (!base64) {
    res.status(404).json({ ok: false, error: 'No creds.json found yet. Pair first.' });
    return;
  }

  res.json({ ok: true, session: base64 });
});

const port = settings.SESSION_SERVER_PORT || settings.PORT || 3000;
app.listen(port, () => {
  logger.info(`Session server running at http://localhost:${port}`);
});
