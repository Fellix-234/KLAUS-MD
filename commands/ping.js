module.exports = {
  name: 'ping',
  aliases: ['speed'],
  description: 'Check bot latency.',

  async execute({ chatId, msg, sendStatusLike }) {
    const start = Date.now();
    await sendStatusLike(chatId, '🏓 Checking response speed...', msg, { typingMs: 300 });
    const diff = Date.now() - start;
    await sendStatusLike(chatId, `⚡ Pong: ${diff}ms`, msg, { typingMs: 350 });
  }
};
