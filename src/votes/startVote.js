const { Markup } =
require("telegraf");

const pool =
require("../database/db");

module.exports = (
bot,
userStates
) => {

//
// START
//
bot.start(
async (ctx) => {


  const ADMIN_ID =
    process.env.ADMIN_ID;

  //
  // ADMIN
  //
  if (
    ctx.from.id.toString() ===
    ADMIN_ID
  ) {

    return ctx.reply(
      "👑 Ви увійшли як адміністратор\n\n/admin"
    );
  }

  //
  // ACTIVE POLL
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

  if (!poll) {

    return ctx.reply(
      "❌ Зараз немає активного голосування."
    );
  }

  if (
  poll.poll_type ===
  "custom"
) {

  const result =
    await pool.query(
      `
      SELECT *
      FROM poll_options
      WHERE poll_id = $1
      ORDER BY id
      `,
      [poll.id]
    );

  const buttons =
  result.rows.map(
    (option) => [
      Markup.button.callback(
  `◀️ ${option.title} ▶️`,
        poll.vote_type === "donate"
          ? `donate_option_${option.id}`
          : `option_${option.id}`
      ),
    ]
  );

  return ctx.reply(
    "🏆 Оберіть варіант:",
    Markup.inlineKeyboard(
      buttons
    )
  );
}

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
  "🏆 Оберіть район для голосування:",
  Markup.inlineKeyboard(
    buttons
  )
);

   
}


);

//
// DEEP LINK
//
bot.command(
"start",
async (ctx, next) => {


  const text =
    ctx.message.text;

  if (
    text !== "/start vote"
  ) {
    return next();
  }

  //
  // ACTIVE POLL
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

  if (!poll) {

    return ctx.reply(
      "❌ Зараз немає активного голосування."
    );
  }

  if (
  poll.poll_type ===
  "custom"
) {

  const result =
    await pool.query(
      `
      SELECT *
      FROM poll_options
      WHERE poll_id = $1
      ORDER BY id
      `,
      [poll.id]
    );

  const buttons =
  result.rows.map(
    (option) => [
      Markup.button.callback(
  `◀️ ${option.title} ▶️`,
        poll.vote_type === "donate"
          ? `donate_option_${option.id}`
          : `option_${option.id}`
      ),
    ]
  );

  return ctx.reply(
    "🏆 Оберіть варіант:",
    Markup.inlineKeyboard(
      buttons
    )
  );
}

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
  "🏆 Оберіть район для голосування:",
  Markup.inlineKeyboard(
    buttons
  )
);

   
}


);

//
// SELECT DISTRICT
//
bot.action(
/^vote_([^_]+)$/,
async (ctx) => {


  try {

    //
    // ACTIVE POLL
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

    if (!poll) {

      return ctx.reply(
        "❌ Голосування завершено."
      );
    }

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

    userStates[
      ctx.from.id
    ] = {
      district:
        districtData.code,

      districtName:
        districtData.name,

      districtEmoji:
        districtData.emoji,
    };

    await ctx.reply(
      `🏆 Ви голосуєте за район:\n\n` +

      `${districtData.emoji} ` +
      `${districtData.name}\n\n` +

      `💸 1 грн = 1 голос\n\n` +

      `Оберіть спосіб голосування 👇`,

      {
        reply_markup: {
          inline_keyboard: [

            [
              {
                text:
                  "💳 Донат + коментар",

                callback_data:
                  `vote_comment_${districtData.code}`
              }
            ],

            [
              {
                text:
                  "📸 Донат + скрін",

                callback_data:
                  `vote_screenshot_${districtData.code}`
              }
            ],

          ]
        }
      }
    );

  } catch (error) {

    console.log(error);
  }
}


);
//
// CUSTOM OPTION VOTE
//
bot.action(
  /^option_(\d+)$/,
  async (ctx) => {

    try {

      const optionId =
        Number(
          ctx.match[1]
        );

      //
      // ACTIVE POLL
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

      if (!poll) {

        return ctx.answerCbQuery(
          "Голосування завершено"
        );
      }

      //
      // ALREADY VOTED
      //
      const votedResult =
        await pool.query(
          `
          SELECT id
          FROM votes
          WHERE
            user_id = $1
            AND poll_id = $2
          LIMIT 1
          `,
          [
            ctx.from.id,
            poll.id
          ]
        );

      if (
        votedResult.rows.length
      ) {

        return ctx.answerCbQuery(
          "❌ Ви вже голосували"
        );
      }

      //
      // OPTION
      //
      const optionResult =
        await pool.query(
          `
          SELECT *
          FROM poll_options
          WHERE id = $1
          LIMIT 1
          `,
          [optionId]
        );

      const option =
        optionResult.rows[0];

      if (!option) {

        return ctx.answerCbQuery(
          "Варіант не знайдено"
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
          status,
          option_code,
          poll_id
        )
        VALUES (
          $1,
          $2,
          '',
          1,
          'approved',
          $3,
          $4
        )
        `,
        [
          ctx.from.id,
          ctx.from.username || "",
          option.code,
          poll.id
        ]
      );

      //
      // INCREMENT
      //
      await pool.query(
        `
        UPDATE poll_options
        SET votes = votes + 1
        WHERE id = $1
        `,
        [optionId]
      );

      await ctx.answerCbQuery(
        "✅ Ваш голос зараховано"
      );

      await ctx.reply(
        `✅ Ви проголосували за:\n\n🔹 ${option.title}`
      );

    } catch (error) {

      console.log(error);

      await ctx.answerCbQuery(
        "Помилка голосування"
      );
    }
   }
);

//
// CUSTOM DONATE OPTION
//
bot.action(
  /^donate_option_(\d+)$/,
  async (ctx) => {

    try {

      await ctx.reply(
        "Оберіть спосіб голосування 👇",
        {
          reply_markup: {
            inline_keyboard: [

  [
    {
      text:
        "💳 Донат + коментар",

      callback_data:
        `vote_comment_option_${ctx.match[1]}`
    }
  ],

  [
    {
      text:
        "📸 Донат + скрін",

      callback_data:
        `vote_screenshot_option_${ctx.match[1]}`
    }
  ]

]
          }
        }
      );

    } catch (error) {

      console.log(error);
    }
  }
);

};
