// logger.js — KLAUS-MD Ultimate Logger

const fs = require("fs")
const path = require("path")
const { createLogger, format, transports } = require("winston")
const chalk = require("chalk")

const BOT_NAME = "KLAUS-MD"
const ENV = process.env.NODE_ENV || "development"

// Create logs folder automatically
const logDir = path.join(__dirname, "logs")
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)

// Timestamp
const timeFormat = format.timestamp({
  format: "YYYY-MM-DD HH:mm:ss"
})

// Console format
const logFormat = format.printf(({ level, message, timestamp, stack }) => {
  return stack
    ? `${timestamp} | ${level.toUpperCase()} | ${stack}`
    : `${timestamp} | ${level.toUpperCase()} | ${message}`
})

// Winston core logger
const logger = createLogger({
  level: ENV === "production" ? "info" : "debug",
  format: format.combine(
    timeFormat,
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: "logs/error.log", level: "error" }),
    new transports.File({ filename: "logs/combined.log" })
  ]
})

logger.add(
  new transports.Console({
    format: format.combine(timeFormat, logFormat)
  })
)


// 🌈 Pretty logger wrapper
const log = {

  // ⚙️ Logger setup (called by botSettings or setting module)
  setup: () => {
    const text = `⚙️ LOGGER SETUP COMPLETE`
    console.log(chalk.hex("#00BFFF")(text))
    logger.info(text)
  },

  // 🚀 BOT START
  startup: () => {
    const text = `🚀 ${BOT_NAME} STARTED (${ENV.toUpperCase()})`
    console.log(chalk.bold.green(text))
    logger.info(text)
  },

  shutdown: () => {
    const text = `🛑 ${BOT_NAME} STOPPED`
    console.log(chalk.red.bold(text))
    logger.warn(text)
  },

  info: (msg) => {
    console.log(chalk.cyan(`ℹ️ ${msg}`))
    logger.info(msg)
  },

  success: (msg) => {
    console.log(chalk.green(`✅ ${msg}`))
    logger.info(msg)
  },

  warn: (msg) => {
    console.log(chalk.yellow(`⚠️ ${msg}`))
    logger.warn(msg)
  },

  error: (err) => {
    console.log(chalk.red(`❌ ${err.message || err}`))
    logger.error(err)
  },

  // 🔍 Detailed error with trace and context
  errorTrace: (error, context = "") => {
    const errMsg = error?.stack || error?.message || error
    const text = `❌ ${context} ${errMsg}`
    console.log(chalk.red(text))
    logger.error(text)
  },

  debug: (msg) => {
    if (ENV !== "production") {
      console.log(chalk.magenta(`🐞 ${msg}`))
      logger.debug(msg)
    }
  },

  // 📩 Incoming message
  incoming: (from, name, message) => {
    const text = `📩 FROM ${name || "Unknown"} (${from}) → ${message}`
    console.log(chalk.blue(text))
    logger.info(text)
  },

  // 📤 Outgoing message
  outgoing: (to, message) => {
    const text = `📤 TO ${to} → ${message}`
    console.log(chalk.green(text))
    logger.info(text)
  },

  // 📊 Command usage
  command: (cmd, user) => {
    const text = `🤖 COMMAND "${cmd}" used by ${user}`
    console.log(chalk.hex("#00FFD1")(text))
    logger.info(text)
  },

  // 👥 Group events
  group: (action, groupName, user) => {
    const text = `👥 GROUP ${action} | ${user} in ${groupName}`
    console.log(chalk.yellow(text))
    logger.info(text)
  },

  // ❤️ Message reactions
  reaction: (user, emoji, message) => {
    const text = `❤️ REACTION ${emoji} from ${user} → "${message}"`
    console.log(chalk.redBright(text))
    logger.info(text)
  },

  // 👀 Status viewed
  statusView: (user) => {
    const text = `👀 STATUS VIEWED by ${user}`
    console.log(chalk.magentaBright(text))
    logger.info(text)
  },

  // 🔥 Status reaction
  statusReaction: (user, emoji) => {
    const text = `🔥 STATUS REACTION ${emoji} from ${user}`
    console.log(chalk.hex("#FF7A00")(text))
    logger.info(text)
  },

  // 🚀 Boot step
  boot: (step) => {
    const text = `🚀 BOOT | ${step}`
    console.log(chalk.cyan(text))
    logger.info(text)
  },

  // ── Divider (for visual separation)
  divider: () => {
    console.log(chalk.dim("─".repeat(40)))
  },

  // 📊 Key‑Value block (takes any object)
  kvBlock: (key, value) => {
    // If value is an object, format it nicely
    if (typeof value === "object" && value !== null) {
      console.log(chalk.blueBright(`📌 ${key}:`))
      for (const [k, v] of Object.entries(value)) {
        console.log(chalk.blueBright(`   ${k}: ${v}`))
        logger.info(`${key} | ${k}: ${v}`)
      }
    } else {
      const text = `${key}: ${value}`
      console.log(chalk.blueBright(text))
      logger.info(text)
    }
  },

  // 📈 Stat line
  stat: (label, value) => {
    const text = value !== undefined ? `📊 ${label}: ${value}` : `📊 ${label}`
    console.log(chalk.hex("#FFA500")(text))
    logger.info(text)
  },

  // 🔗 Connection status
  connection: (status, details = "") => {
    const text = details ? `🔌 CONNECTION ${status} ${details}` : `🔌 CONNECTION ${status}`
    const color = status === "connected" ? chalk.green : chalk.red
    console.log(color(text))
    logger.info(text)
  },

  // 🎨 ASCII banner (takes object or string)
  banner: (bannerText) => {
    if (typeof bannerText === "object" && bannerText !== null) {
      const { botName, prefix, mode } = bannerText
      const lines = [
        ``,
        `╔══════════════════════════════╗`,
        `║   🤖 ${botName || BOT_NAME}`,
        `║   Prefix: ${prefix || "."}`,
        `║   Mode: ${mode || ENV}`,
        `╚══════════════════════════════╝`,
        ``
      ]
      const bannerStr = lines.join("\n")
      console.log(chalk.hex("#FF00FF")(bannerStr))
      logger.info(bannerStr)
    } else {
      console.log(chalk.hex("#FF00FF")(bannerText))
      logger.info(bannerText)
    }
  },

  // ▶️ Command start
  commandStart: (cmd, user, args) => {
    const text = args?.length
      ? `▶️ CMD START | ${cmd} | ${user} | args: ${args.join(" ")}`
      : `▶️ CMD START | ${cmd} | ${user}`
    console.log(chalk.hex("#00FFD1")(text))
    logger.info(text)
  },

  // ⏹️ Command end
  commandEnd: (cmd, elapsed) => {
    const text = elapsed !== undefined
      ? `⏹️ CMD END | ${cmd} | ${elapsed}ms`
      : `⏹️ CMD END | ${cmd}`
    console.log(chalk.hex("#00FFD1")(text))
    logger.info(text)
  },

  // 🪜 Step tracker
  step: (current, total, description = "") => {
    const text = description
      ? `🪜 STEP [${current}/${total}] ${description}`
      : `🪜 STEP [${current}/${total}]`
    console.log(chalk.hex("#00CED1")(text))
    logger.info(text)
  }

}


// Catch crashes (important)
process.on("uncaughtException", (err) => {
  log.error("UNCAUGHT EXCEPTION: " + err.stack)
})

process.on("unhandledRejection", (reason) => {
  log.error("UNHANDLED PROMISE: " + reason)
})

module.exports = log
