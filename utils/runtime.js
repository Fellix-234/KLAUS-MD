const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function resolveSourceDir() {
  const configured = process.env.BOT_SOURCE_DIR || process.env.SOURCE_DIR || process.env.CODE_DIR;
  if (!configured) return null;

  const resolved = path.isAbsolute(configured) ? configured : path.resolve(rootDir, configured);
  if (resolved === rootDir) return null;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) return null;

  return resolved;
}

function resolveRuntimeEntry(relativePath) {
  const sourceDir = resolveSourceDir();
  if (sourceDir) {
    const candidate = path.join(sourceDir, relativePath);
    if (fs.existsSync(candidate)) return candidate;
  }

  const localCandidate = path.join(rootDir, relativePath);
  if (fs.existsSync(localCandidate)) return localCandidate;

  return null;
}

function requireRuntimeEntry(relativePath) {
  const entry = resolveRuntimeEntry(relativePath);
  if (!entry) {
    throw new Error(`Unable to resolve runtime entry: ${relativePath}`);
  }

  return require(entry);
}

module.exports = {
  rootDir,
  resolveSourceDir,
  resolveRuntimeEntry,
  requireRuntimeEntry
};