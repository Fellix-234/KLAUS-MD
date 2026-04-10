const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '..', 'bot_settings.json');

const defaultSettings = {
  prefix: '',
  autostatus: false,
  autoreact: false,
  autotyping: true,
  autorecording: false,
  stickerPackName: 'KLAUS MD',
  stickerPackAuthor: 'KLAUS TEAM',
  sudo: []
};

function normalizeNumber(raw) {
  return String(raw || '').replace(/[^0-9]/g, '');
}

function ensureSettingsFile() {
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
  }
}

function getSettings() {
  ensureSettingsFile();
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    return { ...defaultSettings, ...raw, sudo: Array.isArray(raw.sudo) ? raw.sudo : [] };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(next) {
  const merged = { ...defaultSettings, ...next, sudo: Array.isArray(next.sudo) ? next.sudo : [] };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
  return merged;
}

function updateSetting(key, value) {
  const current = getSettings();
  current[key] = value;
  return saveSettings(current);
}

function toggleSetting(key, forced) {
  const current = getSettings();
  const nextValue = typeof forced === 'boolean' ? forced : !Boolean(current[key]);
  current[key] = nextValue;
  saveSettings(current);
  return nextValue;
}

function addSudo(number) {
  const current = getSettings();
  const cleaned = normalizeNumber(number);
  if (!cleaned) return { ok: false, message: 'Invalid number.' };
  if (!current.sudo.includes(cleaned)) current.sudo.push(cleaned);
  saveSettings(current);
  return { ok: true, value: cleaned };
}

function removeSudo(number) {
  const current = getSettings();
  const cleaned = normalizeNumber(number);
  current.sudo = current.sudo.filter((x) => x !== cleaned);
  saveSettings(current);
  return { ok: true, value: cleaned };
}

function isSudo(senderJid) {
  const current = getSettings();
  const number = normalizeNumber(String(senderJid || '').split('@')[0].split(':')[0]);
  return current.sudo.includes(number);
}

module.exports = {
  getSettings,
  saveSettings,
  updateSetting,
  toggleSetting,
  addSudo,
  removeSudo,
  isSudo,
  normalizeNumber
};
