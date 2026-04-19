const fs = require('fs');
const { fork } = require('child_process');
const path = require('path');
const settings = require('./setting');
const { resolveSourceDir } = require('./utils/runtime');

const externalSourceDir = resolveSourceDir();

if (externalSourceDir) {
  const externalStart = path.join(externalSourceDir, 'start.js');
  const externalIndex = path.join(externalSourceDir, 'index.js');

  if (fs.existsSync(externalStart)) {
    require(externalStart);
  } else if (fs.existsSync(externalIndex)) {
    require(externalIndex);
  } else {
    throw new Error(`No start.js or index.js found in BOT_SOURCE_DIR: ${externalSourceDir}`);
  }
} else {

const mode = process.env.APP_MODE || settings.APP_MODE;
const mainPort = process.env.PORT || String(settings.PORT);
const sessionPort = process.env.SESSION_SERVER_PORT || String(settings.SESSION_SERVER_PORT);

if (mode === 'both') {
  const bot = fork(require.resolve('./index'), [], {
    env: { ...process.env, APP_MODE: 'bot', PORT: mainPort }
  });

  const session = fork(require.resolve('./session/session-server'), [], {
    env: {
      ...process.env,
      APP_MODE: 'session',
      SESSION_SERVER_PORT: sessionPort,
      PORT: sessionPort
    }
  });

  const shutdown = () => {
    try {
      bot.kill('SIGINT');
    } catch {
      // ignore
    }
    try {
      session.kill('SIGINT');
    } catch {
      // ignore
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  bot.on('exit', (code) => {
    if (code && code !== 0) process.exit(code);
  });
  session.on('exit', (code) => {
    if (code && code !== 0) process.exit(code);
  });
} else if (mode === 'session' || mode === 'session-server') {
  require('./session/session-server');
} else {
  require('./index');
}
}
