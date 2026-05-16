const fs = require('fs');
const path = require('path');
const express = require('express');
const pino = require('pino');
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  delay
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const ENV = require('./setting');
const logger = require('./utils/logger');
const botSettings = require('./utils/botSettings');
const { resolveSourceDir } = require('./utils/runtime');
const { clearExpiredSessions, handleMenuReply } = require('./commands/menuHandler');

const externalSourceDir = resolveSourceDir();

if (externalSourceDir) {
  require(path.join(externalSourceDir, 'index.js'));
  return;
}

const rootDir = __dirname;
const authDir = path.join(rootDir, 'session', 'auth_info_baileys');
const commandsDir = path.join(rootDir, 'commands');
const sessionStatusPath = path.join(rootDir, 'session_status.json');

let sock;
const commandMap = new Map();
const keepAliveApp = express();
const metrics = {
  messages: 0,
  commands: 0,
  commandFailures: 0,
  statusReads: 0,
  autoReacts: 0,
  reconnects: 0,
  totalCommandMs: 0
};

function getBotSettings() {
  return botSettings.getSettings();
}

function getActivePrefix() {
  const settings = getBotSettings();
  return settings.prefix || ENV.PREFIX || '.';
}

function formatMemoryMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptimeShort(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hours}h ${minutes}m ${secs}s`;
}

function getCommandNames() {
  return [...new Set([...commandMap.values()].map((command) => command.name))].sort((a, b) => a.localeCompare(b));
}

function loadCommands() {
  const files = fs.readdirSync(commandsDir).filter((file) => file.endsWith('.js') && file !== 'menuHandler.js');

  logger.info(`Discovering ${files.length} command module(s) in /commands`);

  for (const file of files) {
    const command = require(path.join(commandsDir, file));

    if (!command || typeof command.name !== 'string' || typeof command.execute !== 'function') {
      logger.warn(`Skipped invalid command module: ${file}`);
      continue;
    }

    commandMap.set(command.name, command);

    if (Array.isArray(command.aliases)) {
      for (const alias of command.aliases) {
        commandMap.set(alias, command);
      }
    }
  }

  logger.success(`Loaded ${getCommandNames().length} command name(s) and ${commandMap.size} command key(s).`);
}

function writeSessionStatus(update) {
  let current = {};

  if (fs.existsSync(sessionStatusPath)) {
    try {
      current = JSON.parse(fs.readFileSync(sessionStatusPath, 'utf-8'));
    } catch {
      current = {};
    }
  }

  const merged = { ...current, ...update };
  fs.writeFileSync(sessionStatusPath, JSON.stringify(merged, null, 2));
}

function persistRuntimeMetrics(extra = {}) {
  writeSessionStatus({
    runtime: {
      updatedAt: new Date().toISOString(),
      uptimeSec: Math.floor(process.uptime()),
      messages: metrics.messages,
      commands: metrics.commands,
      commandFailures: metrics.commandFailures,
      statusReads: metrics.statusReads,
      autoReacts: metrics.autoReacts,
      reconnects: metrics.reconnects,
      avgCommandMs: Number(metrics.commands ? (metrics.totalCommandMs / metrics.commands).toFixed(1) : 0)
    },
    ...extra
  });
}

function logStartupProfile() {
  const settings = getBotSettings();
  const memory = process.memoryUsage();

  logger.boot(ENV.BOT_NAME, 'Readable bot runtime');
  logger.divider();
  logger.kvBlock('Environment', {
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    pid: process.pid,
    uptime: `${Math.floor(process.uptime())}s`
  });
  logger.kvBlock('Profile', {
    name: ENV.BOT_NAME,
    mode: ENV.MODE,
    prefix: settings.prefix || ENV.PREFIX,
    owner: ENV.OWNER_NAME || 'Unknown',
    ownerNumber: ENV.OWNER_NUMBER || 'Unknown',
    commandKeys: commandMap.size
  });
  logger.kvBlock('Settings', {
    autostatus: settings.autostatus,
    autoreact: settings.autoreact,
    autotyping: settings.autotyping,
    autorecording: settings.autorecording,
    sudoCount: Array.isArray(settings.sudo) ? settings.sudo.length : 0
  });
  logger.kvBlock('Memory', {
    rss: formatMemoryMB(memory.rss),
    heapTotal: formatMemoryMB(memory.heapTotal),
    heapUsed: formatMemoryMB(memory.heapUsed),
    external: formatMemoryMB(memory.external)
  });
}

function startHealthReporter() {
  setInterval(() => {
    const memory = process.memoryUsage();
    const avgCommandMs = metrics.commands ? (metrics.totalCommandMs / metrics.commands).toFixed(1) : '0.0';

    logger.stat(
      `uptime=${formatUptimeShort(process.uptime())} messages=${metrics.messages} commands=${metrics.commands} failures=${metrics.commandFailures} avg=${avgCommandMs}ms`
    );
    logger.kvBlock('Runtime', {
      uptime: formatUptimeShort(process.uptime()),
      messages: metrics.messages,
      commands: metrics.commands,
      commandFailures: metrics.commandFailures,
      avgCommandMs,
      statusReads: metrics.statusReads,
      autoReacts: metrics.autoReacts,
      reconnects: metrics.reconnects,
      rss: formatMemoryMB(memory.rss),
      heapUsed: formatMemoryMB(memory.heapUsed)
    });

    persistRuntimeMetrics();
  }, 60 * 60 * 1000);
}

// ==================== SESSION DOWNLOADER ====================
const SESSION_PREFIX = 'blinder~';

async function downloadSession() {
  const session = ENV.SESSION || process.env.SESSION;
  if (!session || !session.startsWith(SESSION_PREFIX)) {
    logger.info('No valid SESSION variable found. Using existing session folder if available.');
    return false;
  }

  try {
    const megaFileId = session.replace(SESSION_PREFIX, '');
    logger.info(`Downloading session from MEGA: ${megaFileId}`);

    const { File } = require('megajs');
    const file = File.fromURL(`https://mega.nz/file/${megaFileId}`);

    const credsData = await new Promise((resolve, reject) => {
      file.loadAttributes((err) => {
        if (err) return reject(err);
        file.download((err, data) => {
          if (err) return reject(err);
          resolve(data);
        });
      });
    });

    // Save the downloaded creds.json to auth directory
    fs.mkdirSync(authDir, { recursive: true });
    const credsPath = path.join(authDir, 'creds.json');
    fs.writeFileSync(credsPath, credsData);
    logger.success('Session downloaded from MEGA and saved to auth folder.');
    return true;
  } catch (error) {
    logger.error(`Session download failed: ${error.message}`);
    return false;
  }
}

async function ensureAuthFromSession() {
  // If auth folder already has valid creds.json, skip download
  const credsPath = path.join(authDir, 'creds.json');
  if (fs.existsSync(credsPath) && fs.statSync(credsPath).size > 0) {
    logger.info('Existing session found. Skipping download.');
    return;
  }

  // Try downloading from MEGA
  const downloaded = await downloadSession();
  if (!downloaded) {
    logger.warn('No valid session available. Bot will require QR scanning or pairing code.');
  }
}

async function sendStatusLike(chatId, text, quoted, options = {}) {
  const settings = getBotSettings();
  const typingMs = options.typingMs ?? 900;

  if (settings.autorecording) {
    await sock.sendPresenceUpdate('recording', chatId);
  } else if (settings.autotyping) {
    await sock.sendPresenceUpdate('typing', chatId);
  }

  await delay(typingMs);
  await sock.sendMessage(chatId, { text }, { quoted });
  await sock.sendPresenceUpdate('paused', chatId);
}

function getMessageText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.buttonsResponseMessage?.selectedButtonId ||
    message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

async function notifyOwnerDeployment() {
  if (!ENV.OWNER_NUMBER) return;

  const ownerJid = `${ENV.OWNER_NUMBER}@s.whatsapp.net`;
  const settings = getBotSettings();
  const body = [
    'Deployment complete',
    `Bot: ${ENV.BOT_NAME}`,
    `Owner: ${ENV.OWNER_NAME || 'Unknown'}`,
    `Prefix: ${settings.prefix || ENV.PREFIX}`,
    `Mode: ${ENV.MODE}`,
    `Uptime: ${Math.floor(process.uptime())}s`,
    `Commands loaded: ${getCommandNames().length}`
  ].join('\n');

  try {
    await sock.sendMessage(ownerJid, { text: body });
    logger.success('Deployment summary delivered to the owner.');
  } catch (error) {
    logger.warn(`Could not deliver deployment summary: ${error?.message || error}`);
  }
}

function setupKeepAlive() {
  logger.step(1, 6, 'Starting keep-alive server');
  logger.info(`Keep-alive target port: ${ENV.PORT}`);

  keepAliveApp.get('/', (_req, res) => {
    res.status(200).send('KLAUS MD is running');
  });

  keepAliveApp.listen(ENV.PORT, () => {
    logger.step(2, 6, `Keep-alive server listening on ${ENV.PORT}`);
  });
}

async function startBot() {
  logger.step(3, 6, 'Preparing Baileys auth and socket');

  // Ensure session from MEGA if available
  await ensureAuthFromSession();

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  logger.step(4, 6, `Protocol version ${version.join('.')}`);

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    browser: ['KLAUS MD', 'Desktop', '1.0.0']
  });
// ===== PAIRING CODE LOGIN =====
if (!sock.authState.creds.registered) {
  logger.warn('🔑 No active session detected.');
  logger.info('Requesting WhatsApp pairing code...');

  const phoneNumber = ENV.PAIR_NUMBER || ENV.OWNER_NUMBER;

  if (!phoneNumber) {
    logger.error('❌ No phone number found for pairing!');
    logger.error('Add PAIR_NUMBER=2547xxxxxxx in env.');
  } else {
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      logger.success(`📲 Pairing code: ${code}`);
      logger.info('Open WhatsApp > Linked devices > Link with code');
    } catch (err) {
      logger.error('Failed to get pairing code: ' + err);
    }
  }
              }
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect} = update;


  // ===== CONNECTING =====
  if (connection === 'connecting') {
    logger.connection('🔄 Connecting to WhatsApp servers...');
    writeSessionStatus({ connection: 'connecting' });
    return;
  }

  // ===== CONNECTED SUCCESSFULLY =====
  if (connection === 'open') {
    logger.success('✅ WhatsApp connected successfully!');
    logger.info(`📱 Logged in as: ${sock.user?.name || 'Unknown'}`);
    logger.info(`🆔 Bot number: ${sock.user?.id.split(':')[0]}`);

    writeSessionStatus({
      connection: 'open',
      connectedNumber: sock.user?.id.split(':')[0],
      connectedAt: new Date().toISOString()
    });

    logger.step(5, 6, 'Connection established');
    logger.banner({
      botName: ENV.BOT_NAME,
      prefix: getActivePrefix(),
      mode: ENV.MODE
    });

    await notifyOwnerDeployment();
    return;
  }

  // ===== CONNECTION CLOSED =====
  if (connection === 'close') {
    const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
    const reason = DisconnectReason[statusCode] || statusCode;

    logger.error(`❌ Connection closed. Reason: ${reason}`);

    writeSessionStatus({
      connection: 'closed',
      reason: reason,
      closedAt: new Date().toISOString()
    });

    // ===== LOGGED OUT =====
    if (statusCode === DisconnectReason.loggedOut) {
      logger.error('🚪 Session logged out!');
      logger.warn('Delete the session folder and re-pair the bot.');
      return;
    }

    // ===== RECONNECT =====
    logger.warn('♻️ Reconnecting in 5 seconds...');
    metrics.reconnects += 1;
    setTimeout(() => startBot(), 5000);
  }
});

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg?.message || msg.key?.remoteJid === 'status@broadcast') return;

    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const text = getMessageText(msg.message).trim();
    const settings = getBotSettings();
    const activePrefix = settings.prefix || ENV.PREFIX || '.';
    const senderNumber = String(sender || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const isOwner = Boolean(ENV.OWNER_NUMBER) && senderNumber === ENV.OWNER_NUMBER;
    const isSudoUser = Array.isArray(settings.sudo) && settings.sudo.includes(senderNumber);

    metrics.messages += 1;
    logger.incoming(chatId, sender, isGroup, text.length);

    if (settings.autostatus && chatId === 'status@broadcast') {
      try {
        await sock.readMessages([msg.key]);
        metrics.statusReads += 1;
      } catch {
        // Ignore read failures.
      }
    }

    if (settings.autoreact && chatId !== 'status@broadcast') {
      try {
        await sock.sendMessage(chatId, { react: { text: 'R', key: msg.key } });
        metrics.autoReacts += 1;
      } catch {
        // Ignore react failures.
      }
    }

    clearExpiredSessions(logger);

    const handledByMenu = await handleMenuReply({
      sock,
      msg,
      sender,
      chatId,
      sendStatusLike,
      logger
    });

    if (handledByMenu) return;

    if (!text.startsWith(activePrefix)) return;

    const [rawCommand, ...args] = text.slice(activePrefix.length).trim().split(/\s+/);
    const invokedAs = rawCommand.toLowerCase();
    const command = commandMap.get(invokedAs);

    if (!command) return;

    if (ENV.MODE === 'private' && !isOwner && !isSudoUser) {
      await sendStatusLike(chatId, 'This command is restricted in private mode.', msg, { typingMs: 500 });
      return;
    }

    logger.command(command.name, sender);
    logger.commandStart(command.name, sender, args);
    metrics.commands += 1;

    const startedAt = Date.now();

    try {
      await command.execute({
        sock,
        msg,
        chatId,
        sender,
        args,
        env: { ...ENV, PREFIX: activePrefix },
        invokedAs,
        isOwner,
        isSudoUser,
        isGroup,
        commandCount: getCommandNames().length,
        commandKeyCount: commandMap.size,
        commandNames: getCommandNames(),
        botSettings: settings,
        sendStatusLike,
        logger
      });

      const elapsed = Date.now() - startedAt;
      metrics.totalCommandMs += elapsed;
      logger.commandEnd(command.name, elapsed);
      persistRuntimeMetrics();
    } catch (error) {
      metrics.commandFailures += 1;
      logger.errorTrace(error, `command ${command.name}`);
      persistRuntimeMetrics();

      await sendStatusLike(chatId, 'Command failed while executing.', msg, { typingMs: 400 });
    }
  });

  writeSessionStatus({
    generatedAt: new Date().toISOString(),
    lastBootAt: new Date().toISOString(),
    sessionPresent: Boolean(ENV.SESSION || process.env.SESSION)
  });

  persistRuntimeMetrics();
}

async function main() {
  setupKeepAlive();
  loadCommands();
  logStartupProfile();
  startHealthReporter();

  process.on('uncaughtException', (error) => {
    logger.errorTrace(error, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.errorTrace(error, 'unhandledRejection');
  });

  await startBot();
}

main().catch((error) => {
  logger.errorTrace(error, 'startup');
  process.exit(1);
});
