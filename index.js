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
const {
  clearExpiredSessions,
  handleMenuReply
} = require('./commands/menuHandler');

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

function formatMemoryMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptimeShort(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}h ${m}m ${r}s`;
}

function logStartupProfile() {
  const state = botSettings.getSettings();
  const uptime = Math.floor(process.uptime());
  const mem = process.memoryUsage();

  logger.boot(`${ENV.BOT_NAME} Control Deck`, 'Tactical Runtime Console');
  logger.divider('=');
  logger.kvBlock('Runtime', {
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    pid: process.pid,
    uptime: `${uptime}s`
  });
  logger.kvBlock('Bot Profile', {
    name: ENV.BOT_NAME,
    mode: ENV.MODE,
    prefix: state.prefix || ENV.PREFIX,
    owner: ENV.OWNER_NAME || 'unknown',
    ownerNumber: ENV.OWNER_NUMBER || 'not set',
    commandKeys: commandMap.size
  });
  logger.kvBlock('Automation', {
    autostatus: state.autostatus,
    autoreact: state.autoreact,
    autotyping: state.autotyping,
    autorecording: state.autorecording,
    sudoCount: Array.isArray(state.sudo) ? state.sudo.length : 0
  });
  logger.kvBlock('Memory', {
    rss: formatMemoryMB(mem.rss),
    heapTotal: formatMemoryMB(mem.heapTotal),
    heapUsed: formatMemoryMB(mem.heapUsed),
    external: formatMemoryMB(mem.external)
  });
}

function startHealthReporter() {
  setInterval(() => {
    const mem = process.memoryUsage();
    const avgCmdMs = metrics.commands ? (metrics.totalCommandMs / metrics.commands).toFixed(1) : '0.0';

    logger.stat(
      `pulse uptime=${formatUptimeShort(process.uptime())} msg=${metrics.messages} cmd=${metrics.commands} fail=${metrics.commandFailures} avg=${avgCmdMs}ms`
    );

    logger.kvBlock('Health', {
      uptime: formatUptimeShort(process.uptime()),
      messages: metrics.messages,
      commands: metrics.commands,
      commandFailures: metrics.commandFailures,
      avgCommandMs: avgCmdMs,
      statusReads: metrics.statusReads,
      autoReacts: metrics.autoReacts,
      reconnects: metrics.reconnects,
      rss: formatMemoryMB(mem.rss),
      heapUsed: formatMemoryMB(mem.heapUsed)
    });
  }, 60 * 1000);
}

function getActivePrefix() {
  const state = botSettings.getSettings();
  return state.prefix || ENV.PREFIX;
}

function ensureAuthFromEnv() {
  if (!ENV.SESSION) return;

  const credsPath = path.join(authDir, 'creds.json');
  if (fs.existsSync(credsPath) && fs.statSync(credsPath).size > 0) return;

  fs.mkdirSync(authDir, { recursive: true });
  const decoded = Buffer.from(ENV.SESSION, 'base64').toString('utf-8');
  fs.writeFileSync(credsPath, decoded);
  logger.session('Loaded creds.json from SESSION environment variable.');
}

function loadCommands() {
  const files = fs
    .readdirSync(commandsDir)
    .filter((f) => f.endsWith('.js') && f !== 'menuHandler.js');

  logger.flow(`Discovered ${files.length} command modules in /commands`);

  for (const file of files) {
    const cmd = require(path.join(commandsDir, file));
    if (!cmd?.name || typeof cmd.execute !== 'function') {
      logger.warn(`Skipped invalid command module: ${file}`);
      continue;
    }
    commandMap.set(cmd.name, cmd);
    if (Array.isArray(cmd.aliases)) {
      for (const alias of cmd.aliases) commandMap.set(alias, cmd);
    }
  }
  logger.success(`Loaded ${commandMap.size} command keys.`);
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

async function sendStatusLike(chatId, text, quotedMsg, options = {}) {
  const typingMs = options.typingMs ?? 900;
  const state = botSettings.getSettings();

  if (state.autorecording) {
    await sock.sendPresenceUpdate('recording', chatId);
  } else if (state.autotyping) {
    await sock.sendPresenceUpdate('composing', chatId);
  }
  await delay(typingMs);
  await sock.sendMessage(chatId, { text }, { quoted: quotedMsg });
  await sock.sendPresenceUpdate('paused', chatId);
}

function getMessageText(message) {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    ''
  );
}

async function notifyOwnerDeployment() {
  if (!ENV.OWNER_NUMBER) return;
  const ownerJid = `${ENV.OWNER_NUMBER}@s.whatsapp.net`;
  const activePrefix = getActivePrefix();

  const lines = [
    '🚀 Deployment Complete',
    `• Bot: ${ENV.BOT_NAME}`,
    `• Owner: ${ENV.OWNER_NAME}`,
    `• Prefix: ${activePrefix}`,
    `• Mode: ${ENV.MODE}`,
    `• Uptime: ${Math.floor(process.uptime())}s`,
    `• Commands: ${commandMap.size}`
  ].join('\n');

  try {
    await sock.sendMessage(ownerJid, { text: lines });
    logger.success('Deployment banner delivered to owner.');
  } catch (err) {
    logger.warn(`Unable to send owner deployment banner: ${err.message}`);
  }
}

function setupKeepAlive() {
  logger.step(1, 6, 'Boot sequence started');
  logger.flow(`Initializing keep-alive server on port ${ENV.PORT}`);
  keepAliveApp.get('/', (_, res) => {
    res.status(200).send('KLAUS MD is alive');
  });

  keepAliveApp.listen(ENV.PORT, () => {
    logger.step(2, 6, `HTTP monitor online on :${ENV.PORT}`);
    logger.info(`Keep-alive web server listening on :${ENV.PORT}`);
  });

  if (ENV.KEEP_ALIVE_URL) {
    setInterval(async () => {
      try {
        await fetch(ENV.KEEP_ALIVE_URL, { method: 'GET' });
        logger.info('Keep-alive ping sent successfully.');
      } catch (err) {
        logger.warn(`Keep-alive ping failed: ${err.message}`);
      }
    }, 4 * 60 * 1000);
  }
}

async function startBot() {
  logger.step(3, 6, 'Preparing authentication state');
  logger.flow('Preparing auth state and WhatsApp socket...');
  ensureAuthFromEnv();
  fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  logger.step(4, 6, `Protocol synced (${version.join('.')})`);
  logger.info(`Using Baileys protocol version: ${version.join('.')}`);

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    browser: ['KLAUS MD', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'connecting') {
      logger.connection('Connecting to WhatsApp servers...');
    }

    if (connection === 'open') {
      logger.step(5, 6, 'Transport link established');
      logger.connection('WhatsApp socket connected and ready.');
      logger.banner({ botName: ENV.BOT_NAME, prefix: getActivePrefix(), mode: ENV.MODE });
      logger.success('WhatsApp connection established.');
      logger.step(6, 6, 'Bot is fully operational');
      await notifyOwnerDeployment();
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) metrics.reconnects += 1;
      logger.connection(`Socket closed. reconnect=${shouldReconnect} code=${statusCode || 'unknown'}`);
      logger.warn(`Connection closed. reconnect=${shouldReconnect} code=${statusCode || 'unknown'}`);
      if (shouldReconnect) startBot();
      else logger.error('Session logged out. Regenerate session and restart bot.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = getMessageText(msg.message).trim();
    const state = botSettings.getSettings();
    const activePrefix = state.prefix || ENV.PREFIX;
    const senderNumber = String(sender || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const isOwner = Boolean(ENV.OWNER_NUMBER) && senderNumber === ENV.OWNER_NUMBER;
    const isSudoUser = botSettings.isSudo(sender);
    const isGroup = chatId.endsWith('@g.us');
    metrics.messages += 1;

    logger.incoming(chatId, sender, isGroup, text.length);

    if (state.autostatus && chatId === 'status@broadcast') {
      try {
        await sock.readMessages([msg.key]);
        metrics.statusReads += 1;
      } catch {
        // Ignore status read failures because status visibility differs by account privacy.
      }
    }

    if (state.autoreact && chatId !== 'status@broadcast') {
      try {
        await sock.sendMessage(chatId, {
          react: {
            text: '⚡',
            key: msg.key
          }
        });
        metrics.autoReacts += 1;
      } catch {
        // Ignore reaction failures on unsupported message types.
      }
    }

    clearExpiredSessions(logger);

    const handledMenuReply = await handleMenuReply({
      sock,
      msg,
      sender,
      chatId,
      sendStatusLike,
      logger
    });
    if (handledMenuReply) return;

    if (!text.startsWith(activePrefix)) return;

    const [rawCmd, ...args] = text.slice(activePrefix.length).trim().split(/\s+/);
    const commandName = rawCmd.toLowerCase();
    const command = commandMap.get(commandName);

    if (!command) return;

    if (ENV.MODE === 'private' && !isOwner && !isSudoUser) {
      await sendStatusLike(chatId, '🔒 Bot is in private mode.', msg, { typingMs: 500 });
      return;
    }

    logger.flow(`Executing ${command.name} for ${sender}`);
    logger.command(command.name, sender);
    logger.commandStart(command.name, sender, args.length);
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
        invokedAs: commandName,
        isOwner,
        isSudoUser,
        isGroup,
        commandCount: commandMap.size,
        botSettings: state,
        sendStatusLike,
        logger
      });
      const elapsed = Date.now() - startedAt;
      metrics.totalCommandMs += elapsed;
      logger.commandEnd(command.name, elapsed);
      logger.success(`Command ${command.name} completed in ${elapsed}ms`);
    } catch (err) {
      metrics.commandFailures += 1;
      logger.error(`Command ${command.name} failed: ${err.message}`);
      await sendStatusLike(chatId, '❌ Command failed. Check logs.', msg, { typingMs: 400 });
    }
  });

  writeSessionStatus({
    generatedAt: new Date().toISOString(),
    lastSessionLength: ENV.SESSION ? ENV.SESSION.length : 0
  });
}

setupKeepAlive();
loadCommands();
logStartupProfile();
startHealthReporter();
startBot().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  process.exit(1);
});
