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
