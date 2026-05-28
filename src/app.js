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

const ADMIN_ID =
  process.env.ADMIN_ID;
const {
  registerAdminPanel,
} = require(
  "./admin/panel"
);
const userStates = {};
registerAdminPanel(
  bot,
  ADMIN_ID
);

//
// START
//
bot.start(async (ctx) => {

  const result =
    await pool.query(`
      SELECT *
      FROM districts
      WHERE active = true
      ORDER BY id
    `);

  const buttons =
    result.rows.map(
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

    const district =
      ctx.match[1];

    const districtResult =
      await pool.query(
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
      `https://send.monobank.ua/jar/3NysFcAawr`;

    await ctx.reply(
      `🏆 Ви голосуєте за:\n\n` +

      `${districtData.emoji} ${districtData.name}\n\n` +

      `💸 1 грн = 1 голос\n\n` +

      `⚠️ ВАЖЛИВО\n\n` +

      `У коментарі до донату\n` +
      `напишіть:\n\n` +

      `${districtData.name}\n\n` +

      `❗ Якщо автоматично\n` +
      `голос не зарахувався —\n` +
      `надішліть сюди скрін.\n\n` +

      `👇 Натисніть кнопку нижче`,
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
  if (
  ctx.message.text?.startsWith("/")
) {
  return;
}

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
    `\n\n👇 Голосуйте через бота`;

  text +=
    `\n@bitva_rayoniv_bot`;

  


    text +=
      `\n💸 1 грн = 1 голос`;

    //
    // SEND POST
    //
    const message =
      await bot.telegram.sendMessage(
        process.env.CHANNEL_ID,
        text,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text:
                    "🗳 ПРОГОЛОСУВАТИ",

                  url:
                    "https://t.me/bitva_rayoniv_bot?start=vote"
                }
              ]
            ]
          }
        }
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
// ADD VOTES
//
bot.command("addvote", async (ctx) => {

  if (
    ctx.from.id.toString() !== ADMIN_ID
  ) {
    return;
  }

  try {

    const args =
      ctx.message.text.split(" ");

    const district =
      args[1];

    const amount =
      Number(args[2]);

    if (
      !district ||
      !amount
    ) {

      return ctx.reply(
        "Приклад:\n/addvote cheremushki 50"
      );
    }

    //
    // SAVE VOTE
    //
    await pool.query(
      `
      INSERT INTO votes (
        user_id,
        username,
        district,
        amount,
        status
      )
      VALUES ($1, $2, $3, $4, 'approved')
      `,
      [
        "admin",
        "admin",
        district,
        amount,
      ]
    );

    //
    // GET ACTIVE POLL
    //
    const pollResult =
      await pool.query(`
        SELECT *
        FROM polls
        WHERE is_active = true
        ORDER BY id DESC
        LIMIT 1
      `);

    const poll =
      pollResult.rows[0];

    //
    // TOTALS
    //
    const totalsResult =
      await pool.query(`
        SELECT
          district,
          SUM(amount) as total
        FROM votes
        WHERE status = 'approved'
        GROUP BY district
      `);

    //
    // DISTRICTS
    //
    const districtsResult =
      await pool.query(`
        SELECT *
        FROM districts
        WHERE active = true
        ORDER BY id
      `);

    //
    // BUILD LEADERBOARD
    //
    let leaderboard =
      `🏆 ${poll.title}\n\n`;

    for (
      const districtRow
      of districtsResult.rows
    ) {

      const totalRow =
        totalsResult.rows.find(
          (r) =>
            r.district ===
            districtRow.code
        );

      const total =
        totalRow
          ? totalRow.total
          : 0;

      leaderboard +=
        `${districtRow.emoji} ` +
        `${districtRow.name} — ${total}\n`;
    }

    leaderboard +=
      `\n💸 1 грн = 1 голос`;

    //
    // UPDATE POST
    //
    await bot.telegram.editMessageText(
      process.env.CHANNEL_ID,
      Number(poll.message_id),
      null,
      leaderboard,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  "🗳 ПРОГОЛОСУВАТИ",

                url:
                  "https://t.me/bitva_rayoniv_bot?start=vote"
              }
            ]
          ]
        }
      }
    );

    await ctx.reply(
      "✅ Голоси додано."
    );

  } catch (error) {

    console.log(error);
  }
});

//
// SCREENSHOTS
//
bot.on("photo", async (ctx) => {

  try {

    const photo =
      ctx.message.photo.pop();

    const fileId =
      photo.file_id;

    //
    // USER
    //
    const username =
      ctx.from.username
        ? `@${ctx.from.username}`
        : ctx.from.first_name;

    //
    // SEND TO ADMIN
    //
    await bot.telegram.sendPhoto(
      ADMIN_ID,
      fileId,
      {
        caption:
          `🆕 Новий скрін донату\n\n` +

          `👤 ${username}\n\n` +

          `📸 Перевірте оплату\n` +

          `та вручну додайте голоси.\n\n` +

          `Команда:\n` +

          `/addvote район сума`
      }
    );

    //
    // REPLY USER
    //
    await ctx.reply(
      "✅ Скрин відправлено адміну."
    );

  } catch (error) {

    console.log(error);
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

}, 35000);
