require("dotenv").config();

const { Telegraf } = require("telegraf");

const app = require("./webhook");
const { checkMonobank } = require("./mono");

//
// BOT
//
const bot = new Telegraf(process.env.BOT_TOKEN);

//
// STATES
//
const userStates = {};

//
// ADMIN
//
require("./admin/panel")(bot, userStates);
require("./admin/currentPoll")(bot, userStates);
require("./admin/tournament")(bot, userStates);

//
// POLLS
//
require("./polls/create")(bot, userStates);
require("./polls/finish")(bot, userStates);
require("./polls/timer")(bot, userStates);
require("./polls/liveCountdown")(bot, userStates);

//
// VOTES
//
require("./votes/manualVotes")(bot, userStates);
require("./votes/screenshots")(bot, userStates);   // ← обробляє фото скрінів
require("./votes/commentVotes")(bot, userStates);
require("./votes/startVote")(bot, userStates);      // ← генерує коди, обробляє /start

//
// USER COMMANDS
//
bot.telegram.setMyCommands([
  {
    command: "start",
    description: "🏆 Голосування",
  },
]);

//
// ADMIN COMMANDS
//
bot.telegram.setMyCommands(
  [
    {
      command: "admin",
      description: "👑 Адмін панель",
    },
  ],
  {
    scope: {
      type: "chat",
      chat_id: Number(process.env.ADMIN_ID),
    },
  }
);

//
// START BOT
//
bot.launch({ dropPendingUpdates: true });
console.log("🔥 Bot started");

//
// SERVER
//
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Webhook server started on port ${PORT}`);
});

//
// MONO CHECK (polling кожні 35 сек як резервний варіант)
//
setInterval(() => {
  console.log("🔄 CHECKING MONO");
  checkMonobank(bot);
}, 35000);

//
// ОЧИСТКА ПРОСТРОЧЕНИХ КОДІВ (раз на годину)
// Видаляємо pending_payments у яких expires_at < NOW()
//
const pool = require("./database/db");

setInterval(async () => {
  try {
    const result = await pool.query(`
      DELETE FROM pending_payments
      WHERE expires_at < NOW()
    `);
    if (result.rowCount > 0) {
      console.log(`🧹 Видалено ${result.rowCount} прострочених кодів`);
    }
  } catch (error) {
    console.log("⚠️ Cleanup error:", error.message);
  }
}, 60 * 60 * 1000); // кожну годину
