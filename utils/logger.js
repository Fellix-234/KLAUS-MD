const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
const botLogPath = path.join(logsDir, 'bot.log');
const commandLogPath = path.join(logsDir, 'commands.log');
const errorLogPath = path.join(logsDir, 'errors.log');
const MAX_LOG_SIZE_BYTES = 2 * 1024 * 1024;

function ensureLogFiles() {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  if (!fs.existsSync(botLogPath)) fs.writeFileSync(botLogPath, '');
  if (!fs.existsSync(commandLogPath)) fs.writeFileSync(commandLogPath, '');
  if (!fs.existsSync(errorLogPath)) fs.writeFileSync(errorLogPath, '');
}

function rotateIfNeeded(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.size < MAX_LOG_SIZE_BYTES) return;

    const rotatedPath = `${filePath}.1`;
    if (fs.existsSync(rotatedPath)) fs.rmSync(rotatedPath, { force: true });
    fs.renameSync(filePath, rotatedPath);
    fs.writeFileSync(filePath, '');
  } catch {
    // Ignore rotation failures to avoid affecting bot runtime.
  }
}

function appendLogLine(filePath, text) {
  try {
    ensureLogFiles();
    rotateIfNeeded(filePath);
    fs.appendFileSync(filePath, `${text}\n`);
  } catch {
    // Never crash bot because logging to file failed.
  }
}

function stamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function line(level, msg, color) {
  const levelTag = String(level).padEnd(7, ' ');
  const out = `[${stamp()}] ${levelTag} ${msg}`;
  console.log(color(out));
  appendLogLine(botLogPath, out);
}

function section(title, detail, color) {
  const banner = `==== ${String(title).toUpperCase()} ====`;
  console.log(color(banner));
  if (detail) {
    console.log(color(detail));
  }
}

function divider(char = '-', len = 72) {
  console.log(chalk.gray(String(char).repeat(len)));
}

function kvBlock(title, pairs) {
  const entries = Object.entries(pairs || {});
  section(title, null, chalk.bold.white);
  for (const [key, value] of entries) {
    const label = String(key).padEnd(18, ' ');
    console.log(chalk.gray(`  ${label}: `) + chalk.white(String(value)));
  }
  divider();
}

function obelisk(title, subtitle) {
  const line = '='.repeat(74);
  console.log(chalk.gray(line));
  console.log(chalk.bold.white(`  ${String(title).toUpperCase()}`));
  if (subtitle) {
    console.log(chalk.gray(`  ${subtitle}`));
  }
  console.log(chalk.gray(line));
}

const log = {
  info: (msg) => line('INFO', msg, chalk.cyan),
  success: (msg) => line('SUCCESS', msg, chalk.green),
  warn: (msg) => line('WARN', msg, chalk.yellow),
  error: (msg) => {
    line('ERROR', msg, chalk.red);
    appendLogLine(errorLogPath, `[${stamp()}] ERROR   ${msg}`);
  },
  errorTrace: (err, context = 'runtime') => {
    const message = err?.message || String(err || 'Unknown error');
    const stack = err?.stack || 'No stack trace available';
    line('ERROR', `${context}: ${message}`, chalk.red);
    appendLogLine(errorLogPath, `[${stamp()}] ERROR   ${context}: ${message}`);
    appendLogLine(errorLogPath, stack);
  },
  command: (command, sender) => {
    line('COMMAND', `${command} by ${sender}`, chalk.magenta);
    appendLogLine(commandLogPath, `[${stamp()}] COMMAND ${command} by ${sender}`);
  },
  flow: (msg) => section('Flow', msg, chalk.bold.blue),
  connection: (msg) => section('Connection', msg, chalk.bold.cyan),
  boot: (title, subtitle) => obelisk(title, subtitle),
  step: (current, total, msg) => {
    line('STEP', `[${String(current).padStart(2, '0')}/${String(total).padStart(2, '0')}] ${msg}`, chalk.bold.yellow);
  },
  stat: (msg) => line('STAT', msg, chalk.bold.white),
  incoming: (chatId, sender, isGroup, size) => {
    line('INBOUND', `chat=${chatId} sender=${sender} group=${isGroup} chars=${size}`, chalk.cyan);
  },
  commandStart: (name, sender, args = []) => {
    const argsCount = Array.isArray(args) ? args.length : 0;
    const preview = Array.isArray(args) && args.length
      ? args.slice(0, 5).join(' ').slice(0, 80)
      : '-';
    line('EXEC', `start command=${name} sender=${sender} args=${argsCount}`, chalk.magentaBright);
    appendLogLine(
      commandLogPath,
      `[${stamp()}] START command=${name} sender=${sender} args=${argsCount} preview=${preview}`
    );
  },
  commandEnd: (name, ms) => {
    line('EXEC', `done command=${name} latency=${ms}ms`, chalk.greenBright);
    appendLogLine(commandLogPath, `[${stamp()}] DONE command=${name} latency=${ms}ms`);
  },
  divider,
  kvBlock,
  menu: (msg) => line('MENU', msg, chalk.blue),
  session: (msg) => line('SESSION', msg, chalk.hex('#ff8800')),
  banner: ({ botName, prefix, mode }) => {
    const width = 58;
    const border = '+'.padEnd(width - 1, '-') + '+';
    const row = (label, value) => `| ${label.padEnd(9, ' ')}: ${String(value).padEnd(42, ' ')}|`;

    console.log(chalk.green(border));
    console.log(chalk.green(row('BOT', `${botName} ONLINE`)));
    console.log(chalk.white(row('PREFIX', prefix)));
    console.log(chalk.white(row('MODE', mode)));
    console.log(chalk.white(row('TIME', new Date().toLocaleString())));
    console.log(chalk.green(border));
  }
};

module.exports = log;
