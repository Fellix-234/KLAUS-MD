const fs = require('fs');
const path = require('path');

const quotes = [
  'Discipline builds empires.',
  'Consistency beats motivation every time.',
  'Small progress is still progress.',
  'Learn, build, ship, repeat.'
];

const facts = [
  'Honey never spoils.',
  'Octopuses have three hearts.',
  'Bananas are berries, botanically.',
  'The Eiffel Tower can grow in summer heat.'
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickExistingMedia(baseName) {
  const candidates = ['gif', 'mp4', 'jpg', 'jpeg', 'png', 'webp'];
  for (const ext of candidates) {
    const p = path.join(__dirname, '..', 'lib', `${baseName}.${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

module.exports = {
  name: 'quote',
  aliases: [
    'fact',
    'calc',
    'calculate',
    'translate',
    'tr',
    'tinyurl',
    'shorturl',
    'qr',
    'toqr',
    'weather',
    'time',
    'date',
    'news',
    'repo',
    'about',
    'helpme',
    'ownername'
  ],
  description: 'Utility and cool commands for big-bot feel.',

  async execute({ sock, chatId, msg, args, sendStatusLike, invokedAs, env }) {
    const cmd = (invokedAs || 'quote').toLowerCase();
    const input = args.join(' ').trim();

    if (cmd === 'quote') {
      await sendStatusLike(chatId, `💬 ${pick(quotes)}`, msg, { typingMs: 550 });
      return;
    }

    if (cmd === 'fact') {
      await sendStatusLike(chatId, `🧠 Fact: ${pick(facts)}`, msg, { typingMs: 600 });
      return;
    }

    if (cmd === 'calc' || cmd === 'calculate') {
      if (!input) {
        await sendStatusLike(chatId, 'Usage: .calc 40*8/2', msg, { typingMs: 450 });
        return;
      }
      if (!/^[0-9+\-*/().%\s]+$/.test(input)) {
        await sendStatusLike(chatId, 'Only numeric expressions are allowed.', msg, { typingMs: 450 });
        return;
      }
      try {
        const result = Function(`"use strict"; return (${input})`)();
        await sendStatusLike(chatId, `🧮 ${input} = ${result}`, msg, { typingMs: 500 });
      } catch {
        await sendStatusLike(chatId, 'Invalid expression.', msg, { typingMs: 450 });
      }
      return;
    }

    if (cmd === 'translate' || cmd === 'tr') {
      if (!input) {
        await sendStatusLike(chatId, 'Usage: .tr hello world', msg, { typingMs: 450 });
        return;
      }
      await sendStatusLike(
        chatId,
        `🌐 Translation helper\n\nInput: ${input}\nGoogle Translate: https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(input)}&op=translate`,
        msg,
        { typingMs: 650 }
      );
      return;
    }

    if (cmd === 'tinyurl' || cmd === 'shorturl') {
      if (!input) {
        await sendStatusLike(chatId, 'Usage: .shorturl https://example.com', msg, { typingMs: 450 });
        return;
      }
      await sendStatusLike(
        chatId,
        `🔗 URL Shortener\n\nTry this API URL:\nhttps://tinyurl.com/api-create.php?url=${encodeURIComponent(input)}`,
        msg,
        { typingMs: 650 }
      );
      return;
    }

    if (cmd === 'qr' || cmd === 'toqr') {
      if (!input) {
        await sendStatusLike(chatId, 'Usage: .qr your-text', msg, { typingMs: 450 });
        return;
      }
      await sendStatusLike(
        chatId,
        `🧾 QR Generator\n\nhttps://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(input)}`,
        msg,
        { typingMs: 700 }
      );
      return;
    }

    if (cmd === 'weather') {
      const place = input || 'lagos';
      await sendStatusLike(
        chatId,
        `⛅ Weather lookup for ${place}\n\nhttps://www.google.com/search?q=weather+${encodeURIComponent(place)}`,
        msg,
        { typingMs: 650 }
      );
      return;
    }

    if (cmd === 'time' || cmd === 'date') {
      const now = new Date();
      await sendStatusLike(chatId, `🕒 ${now.toLocaleString()}`, msg, { typingMs: 500 });
      return;
    }

    if (cmd === 'news') {
      await sendStatusLike(chatId, '📰 Top news: https://news.google.com/', msg, { typingMs: 550 });
      return;
    }

    if (cmd === 'repo') {
      const mediaPath = pickExistingMedia('repo');
      const text = '📦 Repo: Add your repository URL in this command.';

      if (mediaPath && mediaPath.endsWith('.gif')) {
        await sock.sendMessage(
          chatId,
          {
            video: fs.readFileSync(mediaPath),
            gifPlayback: true,
            caption: text
          },
          { quoted: msg }
        );
        return;
      }

      if (mediaPath) {
        await sock.sendMessage(
          chatId,
          { image: fs.readFileSync(mediaPath), caption: text },
          { quoted: msg }
        );
        return;
      }

      await sendStatusLike(chatId, text, msg, { typingMs: 550 });
      return;
    }

    if (cmd === 'ownername') {
      await sendStatusLike(chatId, `👤 Owner: ${env.OWNER_NAME || 'Klaus Owner'}`, msg, { typingMs: 450 });
      return;
    }

    const help = [
      '🧰 Extra Tools',
      '• .quote',
      '• .fact',
      '• .calc 5*8',
      '• .tr hello',
      '• .shorturl <url>',
      '• .qr text',
      '• .weather city',
      '• .news',
      '• .ownername'
    ].join('\n');

    await sendStatusLike(chatId, help, msg, { typingMs: 700 });
  }
};
