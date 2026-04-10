const MENU_TIMEOUT_MS = 3 * 60 * 1000;
const menuSessions = new Map();

function buildCommands(baseList, prefix, count) {
  const generated = Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(3, '0');
    return `.${prefix}${n}`;
  });
  return [...baseList, ...generated];
}

const categoryMap = {
  '1': {
    title: '1️⃣ Download Manager',
    body: buildCommands(
      ['.ytmp3', '.ytmp4', '.play', '.media', '.song', '.video', '.tiktok', '.instagram', '.spotify', '.sticker'],
      'dl',
      60
    )
  },
  '2': {
    title: '2️⃣ AI & AI Tools',
    body: buildCommands(['.ai', '.ask', '.chatgpt', '.gemini', '.copilot', '.gpt'], 'ai', 60)
  },
  '3': {
    title: '3️⃣ Settings',
    body: buildCommands(
      [
        '.owner',
        '.setprefix',
        '.getprefix',
        '.resetprefix',
        '.uptime',
        '.botinfo',
        '.autostatus',
        '.autoreact',
        '.autotyping',
        '.autorecording',
        '.setsudo',
        '.setstickerpack'
      ],
      'set',
      61
    )
  },
  '4': {
    title: '4️⃣ Text & Editor',
    body: buildCommands(
      ['.style', '.fancy', '.reverse', '.tinyurl', '.shorturl', '.translate', '.calc', '.qr', '.getpp', '.setpp'],
      'txt',
      61
    )
  },
  '5': {
    title: '5️⃣ Fun & Games',
    body: buildCommands(
      ['.games', '.fun', '.truth', '.dare', '.dice', '.hack', '.quote', '.fact', '.weather', '.news', '.group', '.groupinfo'],
      'fun',
      61
    )
  }
};

const TOTAL_MENU_COMMANDS = Object.values(categoryMap).reduce(
  (sum, category) => sum + category.body.length,
  0
);

function createMenuSession(chatId, sender, logger) {
  const expiresAt = Date.now() + MENU_TIMEOUT_MS;
  menuSessions.set(chatId, { sender, expiresAt });

  if (logger) {
    logger.menu(`Opened menu for ${sender} in ${chatId}. Expires in 3 minutes.`);
  }

  return expiresAt;
}

function clearExpiredSessions(logger) {
  const now = Date.now();
  for (const [chatId, data] of menuSessions.entries()) {
    if (now > data.expiresAt) {
      menuSessions.delete(chatId);
      if (logger) {
        logger.menu(`Menu expired for ${data.sender} in ${chatId}.`);
      }
    }
  }
}

async function handleMenuReply({ sock, msg, sender, chatId, sendStatusLike, logger }) {
  const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
  if (!/^[1-5]$/.test(text)) return false;

  const session = menuSessions.get(chatId);
  if (!session || session.sender !== sender) return false;

  if (Date.now() > session.expiresAt) {
    menuSessions.delete(chatId);
    await sendStatusLike(
      chatId,
      '⌛ Menu session expired. Send .menu again to reopen.',
      msg
    );
    if (logger) {
      logger.menu(`Expired menu attempt by ${sender} in ${chatId}.`);
    }
    return true;
  }

  const category = categoryMap[text];
  const body = [
    `📂 ${category.title}`,
    '',
    ...category.body.map((cmd, idx) => `${idx + 1}. ${cmd}`),
    '',
    'Reply with another number (1-5) or send .menu to refresh.'
  ].join('\n');

  await sendStatusLike(chatId, body, msg, { typingMs: 1100 });
  if (logger) {
    logger.menu(`Category ${text} served to ${sender} in ${chatId}.`);
  }
  return true;
}

module.exports = {
  createMenuSession,
  clearExpiredSessions,
  handleMenuReply,
  MENU_TIMEOUT_MS,
  TOTAL_MENU_COMMANDS
};
