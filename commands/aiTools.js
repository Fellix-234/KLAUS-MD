const DEFAULT_TIMEOUT_MS = 30000;
const fs = require('fs');
const path = require('path');
const settings = require('../setting');

function pickExistingImage(baseName) {
  const exts = ['jpg', 'jpeg', 'png', 'webp'];
  for (const ext of exts) {
    const p = path.join(__dirname, '..', 'lib', `${baseName}.${ext}`);
    if (fs.existsSync(p) && fs.statSync(p).size > 0) return p;
  }
  return null;
}

async function sendWithOptionalAiImage(sock, chatId, msg, text) {
  const imgPath = pickExistingImage('ai');
  if (imgPath) {
    await sock.sendMessage(
      chatId,
      { image: fs.readFileSync(imgPath), caption: text },
      { quoted: msg }
    );
    return;
  }
  await sock.sendMessage(chatId, { text }, { quoted: msg });
}

async function postJson(url, payload, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const msg = data?.error?.message || data?.message || data?.raw || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

function buildUsage(label, command) {
  return `${label} is ready. Use: .${command} your question`;
}

function clipReply(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return 'No response returned by model.';
  return normalized.length > 3500 ? `${normalized.slice(0, 3500)}\n\n[truncated]` : normalized;
}

async function queryOpenAI(prompt) {
  const apiKey = settings.AI.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing.');

  const model = settings.AI.OPENAI_MODEL;
  const url = settings.AI.OPENAI_API_URL;

  const data = await postJson(
    url,
    {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a concise and helpful assistant inside a WhatsApp bot.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7
    },
    {
      Authorization: `Bearer ${apiKey}`
    }
  );

  return data?.choices?.[0]?.message?.content || 'No output from OpenAI model.';
}

async function queryGemini(prompt) {
  const apiKey = settings.AI.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing.');

  const model = settings.AI.GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const data = await postJson(url, {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  });

  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('\n').trim() || 'No output from Gemini model.';
}

async function queryCopilotCompatible(prompt) {
  const apiKey = settings.AI.COPILOT_API_KEY;
  const url = settings.AI.COPILOT_API_URL;
  const model = settings.AI.COPILOT_MODEL;

  if (!apiKey || !url) {
    throw new Error('COPILOT_API_KEY or COPILOT_API_URL is missing.');
  }

  const data = await postJson(
    url,
    {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are GitHub Copilot style coding assistant for WhatsApp bot users.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4
    },
    {
      Authorization: `Bearer ${apiKey}`
    }
  );

  return data?.choices?.[0]?.message?.content || 'No output from Copilot-compatible endpoint.';
}

async function queryAuto(prompt) {
  if (settings.AI.OPENAI_API_KEY) return { label: 'ChatGPT', text: await queryOpenAI(prompt) };
  if (settings.AI.GEMINI_API_KEY) return { label: 'Gemini', text: await queryGemini(prompt) };
  if (settings.AI.COPILOT_API_KEY && settings.AI.COPILOT_API_URL) {
    return { label: 'Copilot', text: await queryCopilotCompatible(prompt) };
  }

  throw new Error('No AI API key found. Set OPENAI_API_KEY or GEMINI_API_KEY.');
}

module.exports = {
  name: 'chatgpt',
  aliases: ['gpt', 'gemini', 'copilot', 'ai', 'ask'],
  description: 'AI-style helper commands.',

  async execute({ sock, chatId, msg, args, sendStatusLike, invokedAs }) {
    const cmd = (invokedAs || 'chatgpt').toLowerCase();
    const prompt = args.join(' ');
    if (!prompt) {
      const usageMap = {
        chatgpt: buildUsage('ChatGPT mode', 'chatgpt'),
        gpt: buildUsage('ChatGPT mode', 'gpt'),
        gemini: buildUsage('Gemini mode', 'gemini'),
        copilot: buildUsage('Copilot mode', 'copilot'),
        ai: buildUsage('AI mode', 'ai'),
        ask: buildUsage('AI mode', 'ask')
      };
      await sendStatusLike(chatId, usageMap[cmd] || usageMap.ai, msg, { typingMs: 500 });
      return;
    }

    const modeLabel = {
      chatgpt: 'ChatGPT',
      gpt: 'ChatGPT',
      gemini: 'Gemini',
      copilot: 'Copilot',
      ai: 'AI Assistant',
      ask: 'AI Assistant'
    }[cmd] || 'AI Assistant';

    await sendStatusLike(chatId, `🧠 ${modeLabel} is thinking...`, msg, { typingMs: 800 });

    try {
      let responseText = '';
      let label = modeLabel;

      if (cmd === 'chatgpt' || cmd === 'gpt') {
        responseText = await queryOpenAI(prompt);
      } else if (cmd === 'gemini') {
        responseText = await queryGemini(prompt);
      } else if (cmd === 'copilot') {
        responseText = await queryCopilotCompatible(prompt);
      } else {
        const auto = await queryAuto(prompt);
        label = auto.label;
        responseText = auto.text;
      }

      const finalText = [`🤖 ${label} Response`, '', clipReply(responseText)].join('\n');
      await sendWithOptionalAiImage(sock, chatId, msg, finalText);
    } catch (err) {
      const help = [
        '❌ AI request failed.',
        `Reason: ${err.message}`,
        '',
        'Set one or more keys in setting.js:',
        '• OPENAI_API_KEY=...',
        '• GEMINI_API_KEY=...',
        '• COPILOT_API_KEY=... (with COPILOT_API_URL)'
      ].join('\n');
      await sendStatusLike(chatId, help, msg, { typingMs: 700 });
    }
  }
};
