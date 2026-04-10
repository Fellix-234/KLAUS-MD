module.exports = {
  name: 'group',
  aliases: ['groupcmd', 'tagall', 'hidetag', 'groupinfo', 'open', 'close'],
  description: 'Group management commands.',

  async execute({ sock, chatId, msg, sendStatusLike, invokedAs }) {
    const cmd = (invokedAs || 'group').toLowerCase();
    const isGroup = chatId.endsWith('@g.us');

    if (!isGroup) {
      await sendStatusLike(chatId, '❌ This command works only in groups.', msg, { typingMs: 450 });
      return;
    }

    if (cmd === 'groupinfo') {
      try {
        const meta = await sock.groupMetadata(chatId);
        const text = [
          '👥 Group Info',
          `• Name: ${meta.subject}`,
          `• Members: ${meta.participants.length}`,
          `• ID: ${meta.id}`
        ].join('\n');
        await sendStatusLike(chatId, text, msg, { typingMs: 700 });
      } catch {
        await sendStatusLike(chatId, 'Unable to fetch group metadata.', msg, { typingMs: 500 });
      }
      return;
    }

    if (cmd === 'tagall' || cmd === 'hidetag') {
      try {
        const meta = await sock.groupMetadata(chatId);
        const mentions = meta.participants.map((p) => p.id);
        const body = mentions.map((jid, i) => `${i + 1}. @${jid.split('@')[0]}`).join('\n');
        await sock.sendMessage(
          chatId,
          {
            text: `📢 Group mention list\n\n${body}`,
            mentions
          },
          { quoted: msg }
        );
      } catch {
        await sendStatusLike(chatId, 'Tag all failed. Check bot admin rights.', msg, { typingMs: 500 });
      }
      return;
    }

    if (cmd === 'open' || cmd === 'close') {
      try {
        await sock.groupSettingUpdate(chatId, cmd === 'open' ? 'not_announcement' : 'announcement');
        await sendStatusLike(chatId, `✅ Group is now ${cmd === 'open' ? 'open' : 'closed'}.`, msg, { typingMs: 650 });
      } catch {
        await sendStatusLike(chatId, 'Failed. Bot must be admin for this action.', msg, { typingMs: 500 });
      }
      return;
    }

    const help = [
      '👥 Group Commands',
      '• .groupinfo',
      '• .tagall',
      '• .hidetag',
      '• .open',
      '• .close'
    ].join('\n');

    await sendStatusLike(chatId, help, msg, { typingMs: 650 });
  }
};
