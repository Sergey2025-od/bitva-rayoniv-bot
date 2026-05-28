require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");

const pool = require("./database/db");
const app = require("./webhook");

const {
  checkMonobank,
} = require("./mono");

const {
  registerAdminPanel,
} = require("./admin/panel");

const bot = new Telegraf(
  process.env.BOT_TOKEN
);

const ADMIN_ID =
  process.env.ADMIN_ID;

const userStates = {};

registerAdminPanel(
  bot,
  ADMIN_ID
);

//
// ADMIN BUTTONS
//
bot.action(
  "admin_create_poll",
  async (ctx) => {

    if (
      ctx.from.id.toString() !==
      ADMIN_ID
    ) {
      return;
    }

    userStates[ctx.from.id] = {
      creatingVote: true,
      step: "title",
    };

    await ctx.reply(
      "📝 Введіть назву голосування"
    );
  }
);

bot.action(
  "admin_current_poll",
  async (ctx) => {

    try {

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

      if (!poll) {

        return ctx.reply(
          "❌ Немає активного голосування"
        );
      }

      const totalsResult =
        await pool.query(`
          SELECT
            district,
            SUM(amount) as total
          FROM votes
          WHERE status = 'approved'
          GROUP BY district
        `);

      const districtsResult =
        await pool.query(`
          SELECT *
          FROM districts
          WHERE active = true
          ORDER BY id
        `);

      let text =
        `🏆 ${poll.title}\n\n`;

      for (
        const district
        of districtsResult.rows
      ) {

        const totalRow =
          totalsResult.rows.find(
            (r) =>
              r.district ===
              district.code
          );

        const total =
          totalRow
            ? totalRow.total
            : 0;

        text +=
          `${district.emoji} ` +
          `${district.name} — ${total}\n`;
      }

      const leftMinutes =
        Math.max(
          0,
          Math.floor(
            (
              Number(poll.end_time) -
              Date.now()
            ) / 60000
          )
        );

      text +=
        `\n\n⏱ Залишилось: ${leftMinutes} хв`;

      await ctx.reply(text);

    } catch (error) {

      console.log(error);
    }
  }
);

bot.action(
  "admin_finish_poll",
  async (ctx) => {

    try {

      const pollResult =
        await pool.query(`
          SELECT *
          FROM polls
          ORDER BY id DESC
          LIMIT 1
        `);

      const poll =
        pollResult.rows[0];

      if (!poll) {

        return ctx.reply(
          "❌ Немає голосування"
        );
      }

      if (!poll.is_active) {

        return ctx.reply(
          "⚠️ Голосування вже завершене"
        );
      }

      await pool.query(`
        UPDATE polls
        SET is_active = false
        WHERE id = ${poll.id}
      `);

      await ctx.reply(
        "🏁 Голосування завершено"
      );

    } catch (error) {

      console.log(error);
    }
  }
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
bot.action(/^vote_([^_]+)$/, async (ctx) => {

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

    userStates[ctx.from.id] = {
      district:
        districtData.code,

      districtName:
        districtData.name,

      districtEmoji:
        districtData.emoji,
    };

    await ctx.reply(
      `🏆 Ви голосуєте за район:\n\n` +

      `${districtData.emoji} ${districtData.name}\n\n` +

      `💸 1 грн = 1 голос\n\n` +

      `Оберіть спосіб голосування 👇`,

      Markup.inlineKeyboard([

        [
          Markup.button.callback(
            "💳 Донат + коментар",
            `vote_comment_${districtData.code}`
          ),
        ],

        [
          Markup.button.callback(
            "📸 Донат + скрін",
            `vote_screenshot_${districtData.code}`
          ),
        ],

      ])
    );

  } catch (error) {

    console.log(error);
  }
});

//
// COMMENT DONATE
//
bot.action(
  /vote_comment_(.+)/,
  async (ctx) => {

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

    const donateUrl =
      `https://send.monobank.ua/jar/3NysFcAawr`;

    await ctx.reply(
      `💳 Донат з коментарем\n\n` +

      `🏆 Район:\n` +

      `${districtData.emoji} ${districtData.name}\n\n` +

      `⚠️ У коментарі до платежу напишіть:\n\n` +

      `${districtData.name}`,

      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "💳 ВІДКРИТИ MONO",
            donateUrl
          ),
        ],
      ])
    );
  }
);

//
// SCREENSHOT DONATE
//
bot.action(
  /vote_screenshot_(.+)/,
  async (ctx) => {

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

    userStates[ctx.from.id] = {
      district:
        districtData.code,

      districtName:
        districtData.name,

      districtEmoji:
        districtData.emoji,
    };

    const donateUrl =
      `https://send.monobank.ua/jar/3NysFcAawr`;

    await ctx.reply(
      `📸 Донат + скрін\n\n` +

      `🏆 Район:\n` +

      `${districtData.emoji} ${districtData.name}\n\n` +

      `1. Задонатьте будь-яку суму\n` +
      `2. Зробіть скрін\n` +
      `3. Надішліть скрін сюди`,

      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "💳 ВІДКРИТИ MONO",
            donateUrl
          ),
        ],
      ])
    );
  }
);

//
// SCREENSHOTS
//
bot.on("photo", async (ctx) => {

  try {

    const state =
      userStates[ctx.from.id];

    if (!state?.district) {

      return ctx.reply(
        "❌ Спочатку оберіть район."
      );
    }

    const photo =
      ctx.message.photo.pop();

    const fileId =
      photo.file_id;

    const username =
      ctx.from.username
        ? `@${ctx.from.username}`
        : ctx.from.first_name;

    await bot.telegram.sendPhoto(
      ADMIN_ID,
      fileId,
      {
        caption:
          `🆕 Новий скрін донату\n\n` +

          `👤 ${username}\n\n` +

          `🏆 Район:\n` +

          `${state.districtEmoji} ` +

          `${state.districtName}`,

        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  "✅ Додати голоси",

                callback_data:
                  `manual_vote_${state.district}`
              }
            ]
          ]
        }
      }
    );

    await ctx.reply(
      "✅ Скрин відправлено адміну."
    );

  } catch (error) {

    console.log(error);
  }
});

//
// MANUAL VOTE
//
bot.action(
  /manual_vote_(.+)/,
  async (ctx) => {

    const district =
      ctx.match[1];

    userStates[ctx.from.id] = {
      addingVotes: true,
      district,
    };

    await ctx.reply(
      "💸 Введіть кількість голосів"
    );
  }
);

//
// UPDATE LEADERBOARD
//
async function updateLeaderboard() {

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

  if (!poll) {
    return;
  }

  const totalsResult =
    await pool.query(`
      SELECT
        district,
        SUM(amount) as total
      FROM votes
      WHERE status = 'approved'
      GROUP BY district
    `);

  const districtsResult =
    await pool.query(`
      SELECT *
      FROM districts
      WHERE active = true
      ORDER BY id
    `);

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
                "https://t.me/bitva_rayoniv_bot"
            }
          ]
        ]
      }
    }
  );
}

//
// MANUAL AMOUNT
//
bot.hears(/^\d+$/, async (ctx, next) => {

  try {

    const state =
      userStates[ctx.from.id];

    if (
      !state?.addingVotes
    ) {
      return next();
    }

    const amount =
      Number(ctx.message.text);

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
        state.district,
        amount,
      ]
    );

    await updateLeaderboard();

    delete userStates[
      ctx.from.id
    ];

    await ctx.reply(
      "✅ Голоси додано"
    );

    return;

  } catch (error) {

    console.log(error);
  }
});

//
// CREATE POST
//
bot.on("message", async (ctx) => {

  try {

    if (
      !ctx.message.text
    ) {
      return;
    }

    if (
      ctx.message.text.startsWith("/")
    ) {
      return;
    }

    const state =
      userStates[ctx.from.id];

    if (!state?.creatingVote) {
      return;
    }

    //
    // TITLE STEP
    //
    if (
      state.step === "title"
    ) {

      state.title =
        ctx.message.text;

      state.step =
        "minutes";

      return ctx.reply(
        "⏱ Введіть час голосування у хвилинах"
      );
    }

    //
    // MINUTES STEP
    //
    if (
      state.step === "minutes"
    ) {

      const minutes =
        Number(ctx.message.text);

      if (!minutes) {

        return ctx.reply(
          "❌ Введіть число"
        );
      }

      state.minutes =
        minutes;

      state.step =
        "create";
    }

    if (
      state.step !== "create"
    ) {
      return;
    }

    const title =
      state.title;

    const endTime =
  new Date(
    Date.now() +
    (
      state.minutes *
      60 *
      1000
    )
  );

    await pool.query(`
      UPDATE polls
      SET is_active = false
    `);

    await pool.query(`
      DELETE FROM votes
    `);

    const districtsResult =
      await pool.query(`
        SELECT *
        FROM districts
        WHERE active = true
        ORDER BY id
      `);

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
                    "https://t.me/bitva_rayoniv_bot"
                }
              ]
            ]
          }
        }
      );

    await pool.query(
      `
      INSERT INTO polls (
        title,
        message_id,
        is_active,
        end_time
      )
      VALUES ($1, $2, true, $3)
      `,
      [
        title,
        message.message_id.toString(),
        endTime,
      ]
    );

    await ctx.reply(
      "✅ Голосування створено."
    );

    delete userStates[
      ctx.from.id
    ];

  } catch (error) {

    console.log(error);

await ctx.reply(
  `❌ Помилка:\n${error.message}`
);
  }
});

//
// AUTO FINISH
//
setInterval(async () => {

  try {

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

    if (!poll) {
      return;
    }

    if (
      Date.now() <
      Number(poll.end_time)
    ) {
      return;
    }

    await pool.query(`
      UPDATE polls
      SET is_active = false
      WHERE id = ${poll.id}
    `);

    const totalsResult =
      await pool.query(`
        SELECT
          district,
          SUM(amount) as total
        FROM votes
       WHERE status = 'approved'
        GROUP BY district
        ORDER BY total DESC
      `);

    const districtsResult =
      await pool.query(`
        SELECT *
        FROM districts
      `);

    const map =
      {};

    districtsResult.rows.forEach(
      (d) => {

        map[d.code] = d;
      }
    );

    const top =
      totalsResult.rows;

    let resultText =
      `🏁 Голосування завершено\n\n`;

    if (top[0]) {

      resultText +=
        `🥇 ${map[top[0].district]?.emoji || ""} ` +
        `${map[top[0].district]?.name || top[0].district} — ${top[0].total}\n`;
    }

    if (top[1]) {

      resultText +=
        `🥈 ${map[top[1].district]?.emoji || ""} ` +
        `${map[top[1].district]?.name || top[1].district} — ${top[1].total}\n`;
    }

    if (top[2]) {

      resultText +=
        `🥉 ${map[top[2].district]?.emoji || ""} ` +
        `${map[top[2].district]?.name || top[2].district} — ${top[2].total}\n`;
    }

    await bot.telegram.editMessageText(
      process.env.CHANNEL_ID,
      Number(poll.message_id),
      null,
      resultText
    );

    console.log(
      "🏁 POLL FINISHED"
    );

  } catch (error) {

    console.log(error);
  }

}, 15000);

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
