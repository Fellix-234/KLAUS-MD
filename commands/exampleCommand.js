module.exports = {
  name: 'example',
  aliases: ['demo'],
  description: 'Example command template.',

  async execute({ chatId, msg, sendStatusLike }) {
    const text = [
      '🧩 Example command executed.',
      'Copy this file to create new commands quickly.',
      'Export: name, aliases, description, execute(ctx).'
    ].join('\n');
    await sendStatusLike(chatId, text, msg, { typingMs: 500 });
  }
};
