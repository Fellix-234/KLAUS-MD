const fs = require('fs');
const path = require('path');
const { createMenuSession, TOTAL_MENU_COMMANDS } = require('./menuHandler');

function pickExistingImage(baseName) {
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  for (const ext of exts) {
    const p = path.join(__dirname, '..', 'lib', `${baseName}.${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

module.exports = {
  name: 'menu',
  aliases: ['help'],
  description: 'Show numbered menu categories.',

  async execute({ sock, chatId, sender, msg, sendStatusLike, logger }) {
    const expiresAt = createMenuSession(chatId, sender, logger);

    const caption = [
      '╭───〔 KLAUS MD MENU 〕───⬣',
      '│',
      '│ 1️⃣ Download Manager',
      '│ 2️⃣ AI & AI Tools',
      '│ 3️⃣ Settings',
      '│ 4️⃣ Text & Editor',
      '│ 5️⃣ Fun & Games',
      '│',
      `│ Commands: ${TOTAL_MENU_COMMANDS}+`,
      `│ Expires: <t:${Math.floor(expiresAt / 1000)}:R>`,
      '│ Reply with number (1-5)',
      '╰──────────────────────────────⬣'
    ].join('\n');

    const menuImage = pickExistingImage('menu');
    const waitText = '📊 Processing request... viewing status...';
    await sendStatusLike(chatId, waitText, msg, { typingMs: 800 });

    if (menuImage) {
      await sock.sendMessage(
        chatId,
        {
          image: fs.readFileSync(menuImage),
          caption
        },
        { quoted: msg }
      );
    } else {
      await sendStatusLike(chatId, caption, msg, { typingMs: 600 });
    }
  }
};
