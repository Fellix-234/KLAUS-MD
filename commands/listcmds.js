module.exports = {
  name: 'listcmds',
  aliases: ['commands', 'cmds'],
  description: 'List the commands currently loaded by the bot.',
  async execute({ chatId, msg, env, commandNames, commandCount, sendStatusLike }) {
    const prefix = env.PREFIX || '.';
    const names = Array.isArray(commandNames) ? commandNames : [];
    const lines = [
      `Loaded commands: ${commandCount}`,
      '',
      ...names.map((name, index) => `${String(index + 1).padStart(2, '0')}. ${prefix}${name}`)
    ];

    await sendStatusLike(chatId, lines.join('\n'), msg, { typingMs: 500 });
  }
};