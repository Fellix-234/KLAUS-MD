function cleanNumber(raw) {
  return String(raw || '').replace(/[^0-9]/g, '');
}

function fromEnv(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === null || value === '' ? fallback : value;
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

const settings = {
  SESSION: fromEnv('SESSION', ''),
  PREFIX: fromEnv('PREFIX', '.'),
  OWNER_NUMBER: cleanNumber(fromEnv('OWNER_NUMBER', '2340000000000')),
  OWNER_NAME: fromEnv('OWNER_NAME', 'Klaus Owner'),
  DEVELOPER_NUMBER: cleanNumber(fromEnv('DEVELOPER_NUMBER', '254725391914')),
  DEVELOPER_NAME: fromEnv('DEVELOPER_NAME', 'Warrior Felix'),
  MODE: fromEnv('MODE', 'public'),
  PORT: parsePort(fromEnv('PORT', '3000'), 3000),
  SESSION_SERVER_PORT: parsePort(fromEnv('SESSION_SERVER_PORT', '3001'), 3001),
  KEEP_ALIVE_URL: fromEnv('KEEP_ALIVE_URL', ''),
  BOT_NAME: fromEnv('BOT_NAME', 'KLAUS MD'),
  APP_MODE: fromEnv('APP_MODE', 'bot'),
  AI: {
    OPENAI_API_KEY: fromEnv('OPENAI_API_KEY', ''),
    OPENAI_MODEL: fromEnv('OPENAI_MODEL', 'gpt-4o-mini'),
    OPENAI_API_URL: fromEnv('OPENAI_API_URL', 'https://api.openai.com/v1/chat/completions'),
    GEMINI_API_KEY: fromEnv('GEMINI_API_KEY', ''),
    GEMINI_MODEL: fromEnv('GEMINI_MODEL', 'gemini-1.5-flash'),
    COPILOT_API_KEY: fromEnv('COPILOT_API_KEY', ''),
    COPILOT_API_URL: fromEnv('COPILOT_API_URL', ''),
    COPILOT_MODEL: fromEnv('COPILOT_MODEL', 'gpt-4o-mini')
  },
  DOWNLOADER: {
    ENABLED: parseBool(fromEnv('DOWNLOADER_ENABLED', ''), false),
    API_BASE_URL: fromEnv('DOWNLOADER_API_BASE_URL', ''),
    ENDPOINT: fromEnv('DOWNLOADER_ENDPOINT', '/download'),
    API_KEY: fromEnv('DOWNLOADER_API_KEY', ''),
    API_KEY_HEADER: fromEnv('DOWNLOADER_API_KEY_HEADER', 'x-api-key'),
    API_KEY_QUERY_NAME: fromEnv('DOWNLOADER_API_KEY_QUERY_NAME', 'apikey'),
    DEFAULT_QUALITY: fromEnv('DOWNLOADER_DEFAULT_QUALITY', '128')
  }
};

module.exports = settings;
