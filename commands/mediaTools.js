const settings = require('../setting');
const { looksLikeUrl, requestDownload } = require('../utils/downloaderProvider');

function enc(text) {
  return encodeURIComponent(String(text || '').trim());
}

function buildDownloaderLinks(query) {
  const q = enc(query);
  return [
    `• YouTube: https://www.youtube.com/results?search_query=${q}`,
    `• TikTok: https://www.tiktok.com/search?q=${q}`,
    `• Instagram: https://www.instagram.com/explore/tags/${q.replace(/%20/g, '')}`,
    `• Spotify: https://open.spotify.com/search/${q}`
  ];
}

function platformFromCommand(cmd) {
  if (['song', 'play', 'ytmp3', 'spotify', 'lyrics', 'soundcloud'].includes(cmd)) return 'audio';
  if (['video', 'ytmp4'].includes(cmd)) return 'video';
  if (['tiktok'].includes(cmd)) return 'tiktok';
  if (['instagram', 'ig'].includes(cmd)) return 'instagram';
  return 'media';
}

function providerSetupHint() {
  return [
    'Downloader API is not configured yet.',
    'Edit setting.js -> DOWNLOADER:',
    '• ENABLED: true',
    '• API_BASE_URL: "https://your-provider.com"',
    '• ENDPOINT: "/download"',
    '• API_KEY: "your-key"'
  ].join('\n');
}

async function sendProviderResult({ chatId, msg, sendStatusLike, cmd, query }) {
  const type = platformFromCommand(cmd);
  const result = await requestDownload({ type, input: query });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const response = [
    `✅ ${type.toUpperCase()} READY`,
    `• Title: ${result.title || query}`,
    result.duration ? `• Duration: ${result.duration}` : null,
    `• Source: ${result.source}`,
    '',
    `⬇️ Download: ${result.download}`,
    result.thumbnail ? `🖼️ Thumb: ${result.thumbnail}` : null
  ]
    .filter(Boolean)
    .join('\n');

  await sendStatusLike(chatId, response, msg, { typingMs: 950 });
  return { ok: true };
}

module.exports = {
  name: 'play',
  aliases: [
    'song',
    'video',
    'tiktok',
    'instagram',
    'ig',
    'yt',
    'ytmp3',
    'ytmp4',
    'spotify',
    'lyrics',
    'soundcloud',
    'download',
    'dl',
    'media'
  ],
  description: 'Media and downloader style commands.',

  async execute({ chatId, msg, args, sendStatusLike, invokedAs }) {
    const cmd = (invokedAs || 'play').toLowerCase();
    const query = args.join(' ').trim();
    const hasProvider = settings.DOWNLOADER?.ENABLED && settings.DOWNLOADER?.API_BASE_URL;

    if (!query && !['tiktok', 'instagram', 'ig', 'ytmp3', 'ytmp4', 'download', 'dl'].includes(cmd)) {
      await sendStatusLike(chatId, `Usage: .${cmd} <song name or link>`, msg, { typingMs: 500 });
      return;
    }

    if (cmd === 'song' || cmd === 'play') {
      if (hasProvider) {
        const direct = await sendProviderResult({ chatId, msg, sendStatusLike, cmd, query });
        if (direct.ok) return;
      }

      const text = [
        '🎵 SONG / PLAY SEARCH',
        '',
        `Query: ${query}`,
        '',
        'Use one of these links:',
        `• Audio Search: https://www.youtube.com/results?search_query=${enc(query + ' lyrics audio')}`,
        `• Spotify: https://open.spotify.com/search/${enc(query)}`,
        '',
        hasProvider ? 'Provider error occurred, fallback search shown.' : providerSetupHint()
      ].join('\n');
      await sendStatusLike(chatId, text, msg, { typingMs: 900 });
      return;
    }

    if (cmd === 'video') {
      if (hasProvider) {
        const direct = await sendProviderResult({ chatId, msg, sendStatusLike, cmd, query });
        if (direct.ok) return;
      }

      const text = [
        '🎬 VIDEO SEARCH',
        '',
        `Query: ${query}`,
        `• YouTube Video: https://www.youtube.com/results?search_query=${enc(query + ' official video')}`,
        `• Shorts/Reels: https://www.youtube.com/results?search_query=${enc(query + ' shorts')}`,
        '',
        hasProvider ? 'Provider error occurred, fallback search shown.' : providerSetupHint()
      ].join('\n');
      await sendStatusLike(chatId, text, msg, { typingMs: 850 });
      return;
    }

    if (cmd === 'tiktok') {
      if (query && hasProvider && looksLikeUrl(query)) {
        const direct = await sendProviderResult({ chatId, msg, sendStatusLike, cmd, query });
        if (direct.ok) return;
      }

      const text = [
        '🎵 TIKTOK TOOL',
        '',
        query ? `• Search: https://www.tiktok.com/search?q=${enc(query)}` : '• Send with title or link',
        '• Paste any TikTok URL after command for quick extraction flow.',
        '• Example: .tiktok https://www.tiktok.com/@user/video/123',
        '',
        hasProvider ? 'Direct mode works best with full TikTok URL.' : providerSetupHint()
      ].join('\n');
      await sendStatusLike(chatId, text, msg, { typingMs: 850 });
      return;
    }

    if (cmd === 'instagram' || cmd === 'ig') {
      if (query && hasProvider && looksLikeUrl(query)) {
        const direct = await sendProviderResult({ chatId, msg, sendStatusLike, cmd, query });
        if (direct.ok) return;
      }

      const text = [
        '📸 INSTAGRAM TOOL',
        '',
        query ? `• Search: https://www.instagram.com/explore/tags/${enc(query).replace(/%20/g, '')}` : '• Send with username/tag/link',
        '• Example: .instagram cristiano',
        '• Example: .ig https://www.instagram.com/reel/...',
        '',
        hasProvider ? 'Direct mode works best with full Instagram reel/post URL.' : providerSetupHint()
      ].join('\n');
      await sendStatusLike(chatId, text, msg, { typingMs: 850 });
      return;
    }

    if (cmd === 'ytmp3' || cmd === 'ytmp4' || cmd === 'download' || cmd === 'dl' || cmd === 'media') {
      if (query && hasProvider) {
        const inferredCmd = cmd === 'ytmp3' ? 'song' : cmd === 'ytmp4' ? 'video' : cmd;
        const direct = await sendProviderResult({ chatId, msg, sendStatusLike, cmd: inferredCmd, query });
        if (direct.ok) return;
      }

      const text = [
        '⬇️ DOWNLOAD CENTER',
        '',
        query ? `Input: ${query}` : 'Input: (missing link)',
        '',
        'Supported flow:',
        '• YouTube links',
        '• TikTok links',
        '• Instagram reel links',
        '',
        hasProvider ? 'Provider error occurred, fallback mode shown.' : 'Current mode: smart-link assistant (safe mode).',
        hasProvider ? 'Retry with a direct media URL.' : providerSetupHint()
      ].join('\n');
      await sendStatusLike(chatId, text, msg, { typingMs: 900 });
      return;
    }

    if (cmd === 'spotify' || cmd === 'soundcloud' || cmd === 'lyrics') {
      const text = [
        '🎧 MUSIC TOOLS',
        '',
        `Query: ${query || 'not provided'}`,
        `• Spotify Search: https://open.spotify.com/search/${enc(query)}`,
        `• SoundCloud Search: https://soundcloud.com/search?q=${enc(query)}`,
        `• Lyrics Search: https://www.google.com/search?q=${enc(query + ' lyrics')}`
      ].join('\n');
      await sendStatusLike(chatId, text, msg, { typingMs: 850 });
      return;
    }

    const links = buildDownloaderLinks(query || 'klaus md');
    const help = ['📥 MEDIA COMMANDS', '', ...links, '', 'Try: .song, .play, .video, .tiktok, .instagram'].join('\n');
    await sendStatusLike(chatId, help, msg, { typingMs: 800 });
  }
};
