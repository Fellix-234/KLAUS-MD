const fs = require('fs');
const path = require('path');

function pickExistingImage(baseName) {
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  for (const ext of exts) {
    const p = path.join(__dirname, '..', 'lib', `${baseName}.${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

module.exports = {
  name: 'alive',
  aliases: ['runtime', 'status'],
  description: 'Show bot alive status.',

  async execute({ sock, chatId, msg, sendStatusLike, env }) {
    const caption = [
      '✅ KLAUS MD IS ACTIVE',
      '',
      `• Uptime: ${formatUptime(process.uptime())}`,
      `• Mode: ${env.MODE}`,
      `• Prefix: ${env.PREFIX}`,
      `• Node: ${process.version}`
    ].join('\n');

    const imgPath = pickExistingImage('alive');
    if (imgPath) {
      await sock.sendMessage(
        chatId,
        { image: fs.readFileSync(imgPath), caption },
        { quoted: msg }
      );
      return;
    }

    await sendStatusLike(chatId, caption, msg, { typingMs: 700 });
  }
};
