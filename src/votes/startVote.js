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
  // AUTO OPEN VOTING
  //
  const payload =
    ctx.startPayload;

  if (
    payload !== "vote"
  ) {

    return ctx.reply(
      "🏆 Натисніть кнопку голосування у каналі."
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

  //
  // DISTRICTS
  //
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

};
