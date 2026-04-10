const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const {
  getSettings,
  toggleSetting,
  addSudo,
  removeSudo,
  updateSetting,
  normalizeNumber
} = require('../utils/botSettings');

async function imageMessageToBuffer(imageMessage) {
  const stream = await downloadContentFromMessage(imageMessage, 'image');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function readQuotedImage(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || null;
}

function parseToggleArg(arg) {
  if (!arg) return null;
  const v = String(arg).toLowerCase();
  if (['on', 'enable', 'true', '1'].includes(v)) return true;
  if (['off', 'disable', 'false', '0'].includes(v)) return false;
  return null;
}

module.exports = {
  name: 'owner',
  aliases: [
    'ownercmd',
    'autostatus',
    'autoreact',
    'autotyping',
    'autorecording',
    'setsudo',
    'delsudo',
    'sudolist',
    'setpp',
    'getpp',
    'setstickerpack',
    'stickerpack',
    'sticker'
  ],
  description: 'Owner and automation controls.',

  async execute({ sock, chatId, msg, args, sendStatusLike, invokedAs, isOwner, isSudoUser }) {
    const cmd = (invokedAs || 'owner').toLowerCase();
    const callerAllowed = isOwner || isSudoUser;

    if (!callerAllowed && cmd !== 'getpp') {
      await sendStatusLike(chatId, '❌ Owner or sudo only command.', msg, { typingMs: 450 });
      return;
    }

    if (['autostatus', 'autoreact', 'autotyping', 'autorecording'].includes(cmd)) {
      const forced = parseToggleArg(args[0]);
      const value = toggleSetting(cmd, forced);
      await sendStatusLike(chatId, `✅ ${cmd} is now ${value ? 'ON' : 'OFF'}.`, msg, { typingMs: 500 });
      return;
    }

    if (cmd === 'setsudo') {
      const target = normalizeNumber(args[0] || '');
      if (!target) {
        await sendStatusLike(chatId, 'Usage: .setsudo 234xxxxxxxxxx', msg, { typingMs: 400 });
        return;
      }
      addSudo(target);
      await sendStatusLike(chatId, `✅ Added sudo user: ${target}`, msg, { typingMs: 450 });
      return;
    }

    if (cmd === 'delsudo') {
      const target = normalizeNumber(args[0] || '');
      if (!target) {
        await sendStatusLike(chatId, 'Usage: .delsudo 234xxxxxxxxxx', msg, { typingMs: 400 });
        return;
      }
      removeSudo(target);
      await sendStatusLike(chatId, `✅ Removed sudo user: ${target}`, msg, { typingMs: 450 });
      return;
    }

    if (cmd === 'sudolist') {
      const state = getSettings();
      const list = state.sudo.length ? state.sudo.map((n, i) => `${i + 1}. ${n}`).join('\n') : 'No sudo users set.';
      await sendStatusLike(chatId, `🧾 Sudo List\n\n${list}`, msg, { typingMs: 450 });
      return;
    }

    if (cmd === 'setstickerpack' || cmd === 'stickerpack') {
      const joined = args.join(' ').trim();
      if (!joined) {
        const state = getSettings();
        await sendStatusLike(
          chatId,
          `Sticker Pack\n• Name: ${state.stickerPackName}\n• Author: ${state.stickerPackAuthor}\n\nUsage: .setstickerpack Name | Author`,
          msg,
          { typingMs: 600 }
        );
        return;
      }

      const [name, author] = joined.split('|').map((x) => x.trim());
      if (name) updateSetting('stickerPackName', name);
      if (author) updateSetting('stickerPackAuthor', author);
      const state = getSettings();
      await sendStatusLike(
        chatId,
        `✅ Sticker pack updated\n• Name: ${state.stickerPackName}\n• Author: ${state.stickerPackAuthor}`,
        msg,
        { typingMs: 550 }
      );
      return;
    }

    if (cmd === 'setpp') {
      const imageMessage = msg.message?.imageMessage || readQuotedImage(msg);
      if (!imageMessage) {
        await sendStatusLike(chatId, 'Reply to an image or send image with .setpp', msg, { typingMs: 500 });
        return;
      }

      try {
        const buffer = await imageMessageToBuffer(imageMessage);
        const tempPath = path.join(__dirname, '..', 'session', `tmp_setpp_${Date.now()}.jpg`);
        fs.writeFileSync(tempPath, buffer);
        await sock.updateProfilePicture(sock.user.id, { url: tempPath });
        fs.unlinkSync(tempPath);
        await sendStatusLike(chatId, '✅ Bot profile picture updated.', msg, { typingMs: 500 });
      } catch (err) {
        await sendStatusLike(chatId, `❌ setpp failed: ${err.message}`, msg, { typingMs: 500 });
      }
      return;
    }

    if (cmd === 'getpp') {
      try {
        const mention = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const target = mention || msg.key.participant || msg.key.remoteJid;
        const url = await sock.profilePictureUrl(target, 'image');
        await sock.sendMessage(
          chatId,
          {
            image: { url },
            caption: `🖼️ Profile picture for @${target.split('@')[0]}`,
            mentions: [target]
          },
          { quoted: msg }
        );
      } catch {
        await sendStatusLike(chatId, 'No profile picture found for target.', msg, { typingMs: 500 });
      }
      return;
    }

    if (cmd === 'sticker') {
      const imageMessage = msg.message?.imageMessage || readQuotedImage(msg);
      if (!imageMessage) {
        await sendStatusLike(chatId, 'Reply to image with .sticker', msg, { typingMs: 500 });
        return;
      }

      try {
        const buffer = await imageMessageToBuffer(imageMessage);
        await sock.sendMessage(
          chatId,
          {
            sticker: buffer
          },
          { quoted: msg }
        );
      } catch {
        await sendStatusLike(chatId, 'Sticker conversion failed on this host.', msg, { typingMs: 500 });
      }
      return;
    }

    const state = getSettings();
    const ownerMenu = [
      '👑 Owner Commands',
      '• .autostatus on/off',
      '• .autoreact on/off',
      '• .autotyping on/off',
      '• .autorecording on/off',
      '• .setsudo <number>',
      '• .delsudo <number>',
      '• .sudolist',
      '• .setpp (reply image)',
      '• .getpp @user',
      '• .setstickerpack Name | Author',
      `• Current sticker pack: ${state.stickerPackName} by ${state.stickerPackAuthor}`
    ].join('\n');

    await sendStatusLike(chatId, ownerMenu, msg, { typingMs: 650 });
  }
};
