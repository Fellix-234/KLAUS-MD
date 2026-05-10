module.exports = {
  name: 'botinfo',
  aliases: ['about'],
  description: 'Show bot runtime and deployment information.',
  async execute({ chatId, msg, sock, sendStatusLike, env, commandCount, commandNames, botSettings }) {
    const memory = process.memoryUsage();
    const settings = botSettings || {};
    const prefix = env.PREFIX || '.';
    const commandList = Array.isArray(commandNames) ? commandNames.slice(0, 24) : [];
    const body = [
      `Bot: ${env.BOT_NAME || 'KLAUS MD'}`,
      `Mode: ${env.MODE || 'public'}`,
      `Prefix: ${prefix}`,
      `Uptime: ${Math.floor(process.uptime())}s`,
      `Commands: ${commandCount}`,
      `Autotyping: ${Boolean(settings.autotyping)}`,
      `Autoreact: ${Boolean(settings.autoreact)}`,
      `Memory RSS: ${(memory.rss / 1024 / 1024).toFixed(1)} MB`,
      '',
      'Loaded command names:',
      commandList.length ? commandList.map((name) => `${prefix}${name}`).join(', ') : 'No commands loaded.'
    ].join('\n');

    if (msg?.key && sock?.sendMessage) {
      try {
        await sock.sendMessage(chatId, { react: { text: 'I', key: msg.key } });
      } catch {
        // Ignore reaction failures.
      }
    }

    await sendStatusLike(chatId, body, msg, { typingMs: 600 });
  }
};