const pool =
  require("../database/db");

module.exports = (
  bot,
  userStates
) => {

  //
  // SCREENSHOT FLOW
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
          !state?.district
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

        //
        // SEND TO ADMIN
        //
        await bot.telegram.sendPhoto(
          process.env.ADMIN_ID,
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
    }
  );

};