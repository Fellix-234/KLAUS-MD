const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const commandsDir = path.join(__dirname, '..', 'commands');

const options = {
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

const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));
for (const file of files) {
  const filePath = path.join(commandsDir, file);
  const source = fs.readFileSync(filePath, 'utf8');
  const obfuscated = JavaScriptObfuscator.obfuscate(source, options).getObfuscatedCode();
  fs.writeFileSync(filePath, obfuscated, 'utf8');
}

console.log(`Obfuscated ${files.length} command files.`);
