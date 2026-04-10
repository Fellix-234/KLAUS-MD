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
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${settings.BOT_NAME} Session Generator</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          max-width: 500px;
          width: 100%;
          padding: 40px;
        }
        h1 { color: #333; margin-bottom: 10px; font-size: 28px; text-align: center; }
        .subtitle { color: #666; text-align: center; margin-bottom: 30px; font-size: 14px; }
        .step { margin-bottom: 30px; }
        .step-title { color: #667eea; font-weight: 600; margin-bottom: 12px; }
        input[type="text"] {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.3s;
        }
        input[type="text"]:focus { outline: none; border-color: #667eea; }
        button {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        button:hover { transform: translateY(-2px); }
        button:active { transform: translateY(0); }
        .info-box {
          background: #f5f5f5;
          border-left: 4px solid #667eea;
          padding: 12px 16px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .success-box {
          background: #e8f5e9;
          border-left: 4px solid #4caf50;
          padding: 16px;
          border-radius: 4px;
          margin-top: 20px;
        }
        .code-display {
          background: #333;
          color: #4caf50;
          padding: 16px;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          font-size: 24px;
          text-align: center;
          letter-spacing: 4px;
          word-break: break-all;
          margin: 16px 0;
        }
        .error { color: #d32f2f; margin-top: 10px; }
        .hidden { display: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 ${settings.BOT_NAME}</h1>
        <p class="subtitle">WhatsApp Session Pairing</p>

        <div id="step1">
          <div class="step">
            <div class="step-title">Step 1: Enter Your WhatsApp Number</div>
            <div class="info-box">
              Include country code without + sign (e.g., 254725391914)
            </div>
            <input type="text" id="phoneInput" placeholder="254725391914" autocomplete="off">
            <button onclick="generateCode()">Get Pairing Code</button>
            <div id="error" class="error"></div>
          </div>
        </div>

        <div id="step2" class="hidden">
          <div class="success-box">
            <div class="step-title">Your Pairing Code:</div>
            <div class="code-display" id="codeDisplay"></div>
            <p style="font-size: 13px; color: #555; margin-top: 12px;">
              Open <strong>WhatsApp</strong> → <strong>Settings</strong> → <strong>Linked Devices</strong> → <strong>Link a Device</strong> and enter this code.
            </p>
          </div>

          <div class="step" style="margin-top: 30px;">
            <div class="step-title">Step 2: Export Session String</div>
            <div class="info-box">
              After linking on your phone, export the session credentials below.
            </div>
            <button onclick="exportSession()">Export Session String</button>
            <div id="sessionResult" class="hidden" style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-top: 15px;">
              <p style="font-size: 12px; color: #666; margin-bottom: 10px;"><strong>Session String (copy this to your environment):</strong></p>
              <textarea id="sessionValue" readonly style="width: 100%; height: 120px; padding: 10px; font-family: monospace; font-size: 11px; border: 1px solid #ddd; border-radius: 4px;"></textarea>
              <button onclick="copySession()" style="margin-top: 10px; background: #4caf50;">📋 Copy to Clipboard</button>
            </div>
          </div>

          <button onclick="startOver()" style="background: #757575; margin-top: 20px;">Start Over</button>
        </div>
      </div>

      <script>
        async function generateCode() {
          const phone = document.getElementById('phoneInput').value.replace(/[^0-9]/g, '');
          const error = document.getElementById('error');
          error.innerHTML = '';

          if (!phone) {
            error.innerHTML = '⚠️ Please enter a valid phone number';
            return;
          }

          try {
            const res = await fetch('/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: 'number=' + phone
            });
            const data = await res.json();

            if (data.ok) {
              document.getElementById('codeDisplay').textContent = data.pairingCode;
              document.getElementById('step1').classList.add('hidden');
              document.getElementById('step2').classList.remove('hidden');
            } else {
              error.innerHTML = '❌ ' + data.error;
            }
          } catch (e) {
            error.innerHTML = '❌ Server error: ' + e.message;
          }
        }

        async function exportSession() {
          try {
            const res = await fetch('/export');
            const data = await res.json();

            if (data.ok) {
              document.getElementById('sessionValue').value = data.session;
              document.getElementById('sessionResult').classList.remove('hidden');
            } else {
              alert('❌ ' + data.error);
            }
          } catch (e) {
            alert('❌ Error: ' + e.message);
          }
        }

        function copySession() {
          const textarea = document.getElementById('sessionValue');
          textarea.select();
          document.execCommand('copy');
          alert('✅ Session string copied to clipboard!');
        }

        function startOver() {
          document.getElementById('phoneInput').value = '';
          document.getElementById('error').innerHTML = '';
          document.getElementById('sessionResult').classList.add('hidden');
          document.getElementById('step1').classList.remove('hidden');
          document.getElementById('step2').classList.add('hidden');
        }

        // Auto-focus phone input
        document.getElementById('phoneInput').focus();
      </script>
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
