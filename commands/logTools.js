const fs = require('fs');
const path = require('path');

const BOT_LOG = path.join(__dirname, '..', 'logs', 'bot.log');
const COMMAND_LOG = path.join(__dirname, '..', 'logs', 'commands.log');
const ERROR_LOG = path.join(__dirname, '..', 'logs', 'errors.log');
const STATUS_FILE = path.join(__dirname, '..', 'session_status.json');

function toPositiveInt(raw, fallback = 15, max = 50) {
  const n = Number.parseInt(String(raw || ''), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function tailLines(filePath, lines = 15) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf-8');
  if (!text.trim()) return [];
  const all = text.split(/\r?\n/).filter(Boolean);
  return all.slice(-lines);
}

function formatRuntime(runtime) {
  if (!runtime || typeof runtime !== 'object') return 'No runtime metrics yet.';
  const avg = Number.isFinite(runtime.avgCommandMs) ? runtime.avgCommandMs : 0;
  return [
    `• Updated: ${runtime.updatedAt || 'N/A'}`,
    `• Uptime: ${runtime.uptimeSec || 0}s`,
    `• Messages: ${runtime.messages || 0}`,
    `• Commands: ${runtime.commands || 0}`,
    `• Failures: ${runtime.commandFailures || 0}`,
    `• Avg Cmd: ${avg}ms`,
    `• Auto Reacts: ${runtime.autoReacts || 0}`,
    `• Status Reads: ${runtime.statusReads || 0}`,
    `• Reconnects: ${runtime.reconnects || 0}`
  ].join('\n');
}

module.exports = {
  name: 'logs',
  aliases: ['cmdlogs', 'metrics', 'stats', 'errlogs', 'crashlogs'],
  description: 'View bot logs, command logs, error logs, and runtime metrics.',

  async execute({ chatId, msg, args, sendStatusLike, invokedAs, isOwner, isSudoUser }) {
    const cmd = (invokedAs || 'logs').toLowerCase();
    if (!(isOwner || isSudoUser)) {
      await sendStatusLike(chatId, '❌ Owner or sudo only command.', msg, { typingMs: 450 });
      return;
    }

    if (cmd === 'metrics' || cmd === 'stats') {
      let status = {};
      try {
        status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
      } catch {
        status = {};
      }

      const text = ['📈 Runtime Metrics', '', formatRuntime(status.runtime)].join('\n');
      await sendStatusLike(chatId, text, msg, { typingMs: 700 });
      return;
    }

    const lineCount = toPositiveInt(args[0], 20, 80);
    let target = BOT_LOG;
    let heading = '📜 Bot Logs';

    if (cmd === 'cmdlogs') {
      target = COMMAND_LOG;
      heading = '🧾 Command Logs';
    }

    if (cmd === 'errlogs' || cmd === 'crashlogs') {
      target = ERROR_LOG;
      heading = '🚨 Error Logs';
    }

    const lines = tailLines(target, lineCount);

    if (!lines.length) {
      await sendStatusLike(chatId, `${heading}\n\nNo log entries yet.`, msg, { typingMs: 500 });
      return;
    }

    const body = lines.join('\n');
    const text = [heading, '', body].join('\n');
    await sendStatusLike(chatId, text.slice(0, 3500), msg, { typingMs: 900 });
  }
};
