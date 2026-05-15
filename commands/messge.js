const { handleCommand } = require("./commands");

function setupMessageHandler(sock) {

sock.ev.on("messages.upsert", async ({ messages }) => {
try {

const msg = messages[0];
if (!msg.message) return;

const from = msg.key.remoteJid;
const isGroup = from.endsWith("@g.us");

// Ignore group messages for now
if (isGroup) return;

const senderName = msg.pushName || "User";

// Get message text
const messageText =
msg.message.conversation ||
msg.message.extendedTextMessage?.text ||
"";

if (!messageText.startsWith(".")) return;

const command = messageText.slice(1).toLowerCase().trim();

console.log("📩 Command received:", command);

await handleCommand(sock, msg, command, senderName, from);

} catch (err) {
console.log("❌ Message Handler Error:", err);
}
});

}

module.exports = { setupMessageHandler };
