const fs = require('fs');
const path = require('path');

const truths = [
  'What secret habit do you have?',
  'Who was your first crush?',
  'What is your biggest fear?',
  'What was your most embarrassing moment?'
];

const dares = [
  'Send a voice note saying hello in 3 accents.',
  'Type your next message with eyes closed.',
  'Send your oldest selfie in gallery.',
  'Write a funny poem in one minute.'
];

const jokes = [
  'Why did the bot cross the chat? To deliver commands faster.',
  'I told my bot to stop joking... it returned syntax error.',
  'Bots do not sleep, they just wait for .menu.'
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickExistingImage(baseName) {
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  for (const ext of exts) {
    const p = path.join(__dirname, '..', 'lib', `${baseName}.${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

async function sendWithOptionalFunImage(sock, chatId, msg, text, sendStatusLike, typingMs = 600) {
  const imgPath = pickExistingImage('fun');
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

module.exports = {
  name: 'games',
  aliases: ['game', 'fun', 'dice', 'truth', 'dare', 'joke', 'hack'],
  description: 'Games and fun commands.',

  async execute({ sock, chatId, msg, sendStatusLike, invokedAs, args }) {
    const cmd = (invokedAs || 'games').toLowerCase();

    if (cmd === 'dice') {
      const roll = Math.floor(Math.random() * 6) + 1;
      await sendStatusLike(chatId, `🎲 Dice roll result: ${roll}`, msg, { typingMs: 500 });
      return;
    }

    if (cmd === 'truth') {
      await sendStatusLike(chatId, `🫣 Truth: ${pick(truths)}`, msg, { typingMs: 600 });
      return;
    }

    if (cmd === 'dare') {
      await sendStatusLike(chatId, `🔥 Dare: ${pick(dares)}`, msg, { typingMs: 600 });
      return;
    }

    if (cmd === 'joke') {
      await sendStatusLike(chatId, `😂 ${pick(jokes)}`, msg, { typingMs: 450 });
      return;
    }

    if (cmd === 'hack') {
      const target = args.join(' ') || 'target';
      await sendStatusLike(chatId, `🧪 Initializing hack module for ${target}...`, msg, { typingMs: 700 });
      await sendStatusLike(chatId, '📡 Bypassing firewall... 42%', msg, { typingMs: 800 });
      await sendStatusLike(chatId, '✅ Completed (prank mode only).', msg, { typingMs: 700 });
      return;
    }

    const menu = [
      '🎮 Games & Fun',
      '',
      '• .dice',
      '• .truth',
      '• .dare',
      '• .joke',
      '• .hack <name>'
    ].join('\n');

    await sendWithOptionalFunImage(sock, chatId, msg, menu, sendStatusLike, 650);
  }
};
