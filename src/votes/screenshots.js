const pool =
require("../database/db");

module.exports = (
bot,
userStates
) => {

//
// DISTRICT SCREENSHOT FLOW
//
bot.action(
/^vote_screenshot_(?!option_)(.+)$/,
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

  const donateUrl =
    `https://send.monobank.ua/jar/3NysFcAawr`;

  await ctx.reply(
    `📸 Донат + скрін\n\n` +

    `🏆 Район:\n` +

    `${districtData.emoji} ` +
    `${districtData.name}\n\n` +

    `1. Задонатьте будь-яку суму\n` +
    `2. Зробіть скрін\n` +
    `3. Надішліть скрін сюди`,

    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text:
                "💳 ВІДКРИТИ MONO",

              url:
                donateUrl
            }
          ]
        ]
      }
    }
  );
}


);

//
// CUSTOM SCREENSHOT FLOW
//
bot.action(
/vote_screenshot_option_(.+)/,
async (ctx) => {


  try {

    const optionId =
      ctx.match[1];

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

      return ctx.reply(
        "❌ Варіант не знайдено"
      );
    }

    userStates[
      ctx.from.id
    ] = {
      customOption:
        option.id,

      customTitle:
        option.title,
    };

    const donateUrl =
      `https://send.monobank.ua/jar/3NysFcAawr`;

    await ctx.reply(
      `📸 Донат + скрін\n\n` +

      `🏆 Варіант:\n\n` +

      `${option.title}\n\n` +

      `1. Задонатьте будь-яку суму\n` +
      `2. Зробіть скрін\n` +
      `3. Надішліть скрін сюди`,

      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  "💳 ВІДКРИТИ MONO",

                url:
                  donateUrl
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

//
// SCREENSHOT RECEIVE
//
bot.on(
"photo",
async (ctx, next) => {


  try {

    const state =
      userStates[
        ctx.from.id
      ];

    if (
      !state?.district &&
      !state?.customOption
    ) {
      return next();
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
      process.env.ADMIN_ID,
      fileId,
      {
        caption:

          state.customOption

            ? `🆕 Новий скрін донату\n\n` +
              `👤 ${username}\n\n` +
              `🏆 Варіант:\n` +
              `${state.customTitle}`

            : `🆕 Новий скрін донату\n\n` +
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

                  state.customOption

                    ? `manual_option_${state.customOption}`

                    : `manual_vote_${state.district}`
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
}


);

};
