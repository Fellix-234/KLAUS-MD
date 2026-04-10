const chalk = require('chalk');

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
  error: (msg) => line('ERROR', msg, chalk.red),
  command: (command, sender) => {
    line('COMMAND', `${command} by ${sender}`, chalk.magenta);
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
  commandStart: (name, sender, argsCount) => {
    line('EXEC', `start command=${name} sender=${sender} args=${argsCount}`, chalk.magentaBright);
  },
  commandEnd: (name, ms) => {
    line('EXEC', `done command=${name} latency=${ms}ms`, chalk.greenBright);
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
