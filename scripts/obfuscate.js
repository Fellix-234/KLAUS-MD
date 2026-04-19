const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { resolveSourceDir } = require('../utils/runtime');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const sourceDir = resolveSourceDir() || rootDir;
const ignoredNames = new Set(['node_modules', '.git', 'dist', 'logs']);
const ignoredPaths = [
  path.join('session', 'auth_info_baileys'),
  'session_status.json'
];

const obfuscationOptions = {
  compact: true,
  simplify: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  rotateStringArray: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  unicodeEscapeSequence: false,
  renameGlobals: false,
  renameProperties: false,
  transformObjectKeys: false,
  selfDefending: false,
  controlFlowFlattening: false,
  deadCodeInjection: false
};

function shouldIgnore(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');
  return ignoredPaths.some((entry) => normalized === entry || normalized.startsWith(`${entry}/`));
}

function ensureParentDir(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function copyOrObfuscate(sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    return;
  }

  if (sourcePath.endsWith('.js')) {
    const code = fs.readFileSync(sourcePath, 'utf8');
    const result = JavaScriptObfuscator.obfuscate(code, obfuscationOptions);
    ensureParentDir(targetPath);
    fs.writeFileSync(targetPath, result.getObfuscatedCode(), 'utf8');
    return;
  }

  ensureParentDir(targetPath);
  fs.copyFileSync(sourcePath, targetPath);
}

function walk(currentDir, relativeDir = '') {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) continue;

    const sourcePath = path.join(currentDir, entry.name);
    const relativePath = path.join(relativeDir, entry.name);
    if (shouldIgnore(relativePath)) continue;

    const targetPath = path.join(distDir, relativePath);
    if (entry.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      walk(sourcePath, relativePath);
      continue;
    }

    copyOrObfuscate(sourcePath, targetPath);
  }
}

function cleanDist() {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });
}

cleanDist();
walk(sourceDir);

console.log(`Obfuscated build written to ${distDir}`);