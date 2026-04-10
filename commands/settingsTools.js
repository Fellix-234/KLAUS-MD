const fs = require('fs');
const path = require('path');
const { getSettings, updateSetting } = require('../utils/botSettings');

function pickExistingImage(baseName) {
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  for (const ext of exts) {
    const p = path.join(__dirname, '..', 'lib', `${baseName}.${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

async function sendWithOptionalSettingsImage(sock, chatId, msg, text, sendStatusLike, typingMs = 650) {
  const imgPath = pickExistingImage('settings');
  if (imgPath) {
    await sock.sendMessage(
      chatId,
      { image: fs.readFileSync(imgPath), caption: text },
      { quoted: msg }
    );
    return;
  }
  await sendStatusLike(chatId, text, msg, { typingMs });
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

module.exports = {
  name: 'setprefix',
  aliases: ['prefix', 'getprefix', 'resetprefix', 'uptime', 'up', 'botinfo', 'sysinfo', 'cmdcount'],
  description: 'Prefix and uptime related commands.',

  async execute({ sock, chatId, msg, args, sendStatusLike, invokedAs, env, isOwner, isSudoUser, commandCount }) {
    const cmd = (invokedAs || 'setprefix').toLowerCase();
    const state = getSettings();
    const currentPrefix = state.prefix || env.PREFIX;

    if (cmd === 'setprefix') {
      if (!(isOwner || isSudoUser)) {
        await sendStatusLike(chatId, '❌ Only owner or sudo can change prefix.', msg, { typingMs: 450 });
        return;
      }

      const next = (args[0] || '').trim();
      if (!next) {
        await sendStatusLike(chatId, `Usage: ${currentPrefix}setprefix !`, msg, { typingMs: 450 });
        return;
      }

      if (next.length > 3) {
        await sendStatusLike(chatId, 'Prefix must be 1-3 characters.', msg, { typingMs: 450 });
        return;
      }

      updateSetting('prefix', next);
      await sendStatusLike(chatId, `✅ Prefix updated to: ${next}`, msg, { typingMs: 500 });
      return;
    }

    if (cmd === 'resetprefix') {
      if (!(isOwner || isSudoUser)) {
        await sendStatusLike(chatId, '❌ Only owner or sudo can reset prefix.', msg, { typingMs: 450 });
        return;
      }

      updateSetting('prefix', '');
      await sendStatusLike(chatId, `✅ Prefix reset to default: ${env.PREFIX}`, msg, { typingMs: 500 });
      return;
    }

    if (cmd === 'prefix' || cmd === 'getprefix') {
      await sendStatusLike(chatId, `🔧 Current prefix: ${currentPrefix}`, msg, { typingMs: 450 });
      return;
    }

    if (cmd === 'uptime' || cmd === 'up') {
      await sendStatusLike(chatId, `⏱️ Uptime: ${formatUptime(process.uptime())}`, msg, { typingMs: 500 });
      return;
    }

    if (cmd === 'botinfo' || cmd === 'sysinfo') {
      const text = [
        '🛰️ BOT INFO',
        '',
        `• Name: ${env.BOT_NAME}`,
        `• Owner: ${env.OWNER_NAME}`,
        `• Prefix: ${currentPrefix}`,
        `• Mode: ${env.MODE}`,
        `• Uptime: ${formatUptime(process.uptime())}`,
        `• Commands: ${commandCount || 'N/A'}`,
        `• Node: ${process.version}`
      ].join('\n');
      await sendWithOptionalSettingsImage(sock, chatId, msg, text, sendStatusLike, 700);
      return;
    }

    if (cmd === 'cmdcount') {
      await sendStatusLike(chatId, `📊 Command keys loaded: ${commandCount || 'N/A'}`, msg, { typingMs: 450 });
      return;
    }

    const help = [
      '⚙️ Settings Tools',
      '• .setprefix !',
      '• .getprefix',
      '• .resetprefix',
      '• .uptime',
      '• .botinfo',
      '• .cmdcount'
    ].join('\n');

    await sendWithOptionalSettingsImage(sock, chatId, msg, help, sendStatusLike, 650);
  }
};
