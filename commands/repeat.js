module.exports = {
  name: 'repeat',
  aliases: ['say'],
  description: 'Repeat the text you send after the command.',
  async execute({ chatId, msg, args, sendStatusLike }) {
    const text = args.join(' ').trim();

    if (!text) {
      await sendStatusLike(chatId, 'Usage: .repeat your text here', msg, { typingMs: 400 });
      return;
    }

    await sendStatusLike(chatId, text, msg, { typingMs: 300 });
  }
};