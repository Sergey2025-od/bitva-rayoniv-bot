require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");

const pool = require("./database/db");
const app = require("./webhook");
const {
  checkMonobank,
} = require("./mono");

const bot = new Telegraf(
  process.env.BOT_TOKEN
);

const ADMIN_ID = process.env.ADMIN_ID;

const userStates = {};

//
// START
//
bot.start(async (ctx) => {

  const result = await pool.query(`
    SELECT *
    FROM districts
    WHERE active = true
    ORDER BY id
  `);

  const buttons = result.rows.map(
    (district) => [
      Markup.button.callback(
        `${district.emoji} ${district.name}`,
        `vote_${district.code}`
      ),
    ]
  );

  await ctx.reply(
    "🏆 Битва районів Одеси\n\nОберіть район:",
    Markup.inlineKeyboard(buttons)
  );
});

//
// VOTE
//
bot.action(/vote_(.+)/, async (ctx) => {

  try {

    const district = ctx.match[1];

    const districtResult = await pool.query(
      `
      SELECT *
      FROM districts
      WHERE code = $1
      LIMIT 1
      `,
      [district]
    );

    const districtData =
      districtResult.rows[0];

    if (!districtData) {
      return ctx.reply(
        "❌ Район не знайдено."
      );
    }

    //
    // DONATE URL
    //
    const donateUrl =
  `https://send.monobank.ua/jar/3NysFcAawr?text=${encodeURIComponent(
    districtData.name
  )}`;

    await ctx.reply(
      `🏆 Ви голосуєте за:\n\n` +
      `${districtData.emoji} ${districtData.name}\n\n` +
      `💸 1 грн = 1 голос\n\n` +
      `👇 Натисніть кнопку нижче для донату`,
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "💳 Задонатити",
            donateUrl
          ),
        ],
      ])
    );

  } catch (error) {

    console.log(error);
  }
});

//
// NEW VOTE
//
bot.command("newvote", async (ctx) => {

  if (
    ctx.from.id.toString() !== ADMIN_ID
  ) {
    return;
  }

  userStates[ctx.from.id] = {
    creatingVote: true,
  };

  await ctx.reply(
    "📝 Введіть назву голосування"
  );
});

//
// CREATE POST
//
bot.on("message", async (ctx) => {

  try {

    if (!ctx.message.text) {
      return;
    }

    const state =
      userStates[ctx.from.id];

    if (!state?.creatingVote) {
      return;
    }

    const title =
      ctx.message.text;

    //
    // CLOSE OLD POLLS
    //
    await pool.query(`
      UPDATE polls
      SET is_active = false
    `);

    //
    // RESET VOTES
    //
    await pool.query(`
      DELETE FROM votes
    `);

    //
    // GET DISTRICTS
    //
    const districtsResult =
      await pool.query(`
        SELECT *
        FROM districts
        WHERE active = true
        ORDER BY id
      `);

    //
    // BUILD TEXT
    //
    let text =
      `🏆 ${title}\n\n`;

    districtsResult.rows.forEach(
      (district) => {

        text +=
          `${district.emoji} ` +
          `${district.name} — 0\n`;
      }
    );

    text +=
      `\n💸 1 грн = 1 голос`;

    text +=
      `\n\n👇 Голосуйте через бота`;

    text +=
  `\nhttps://t.me/bitva_rayoniv_bot?start=vote`;

    //
    // SEND POST
    //
    const message =
  await bot.telegram.sendMessage(
    process.env.CHANNEL_ID,
    text
  );

    //
    // SAVE POLL
    //
    await pool.query(
      `
      INSERT INTO polls (
        title,
        message_id,
        is_active
      )
      VALUES ($1, $2, true)
      `,
      [
        title,
        message.message_id.toString(),
      ]
    );

    await ctx.reply(
      "✅ Голосування створено."
    );

    delete userStates[ctx.from.id];

  } catch (error) {

    console.log(error);

    await ctx.reply(
      "❌ Помилка створення голосування."
    );
  }
});

//
// LAUNCH
//
bot.launch({
  dropPendingUpdates: true,
});

console.log("🔥 Bot started");

//
// WEBHOOK SERVER
//
const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    "🚀 Webhook server started"
  );

});

//
// MONO POLLING
//
console.log(
  "🔥 MONO POLLING ENABLED"
);

setInterval(() => {

  console.log(
    "🔄 CHECKING MONO"
  );

  checkMonobank(bot);

}, 15000);
