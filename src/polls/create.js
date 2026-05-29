const pool =
  require("../database/db");

module.exports = (
  bot,
  userStates
) => {
  //
// POLL TYPE
//
bot.action(
  "admin_poll_type",
  async (ctx) => {

    await ctx.reply(
      "📊 Оберіть тип голосування",
      {
        reply_markup: {
          inline_keyboard: [

            [
              {
                text:
                  "🏘 Битва районів",
                callback_data:
                  "create_district_poll"
              }
            ],

            [
              {
                text:
                  "📝 Власне голосування",
                callback_data:
                  "create_custom_poll"
              }
            ]

          ]
        }
      }
    );

  }
);

//
// DISTRICT POLL
//
bot.action(
  "create_district_poll",
  async (ctx) => {

    userStates[
      ctx.from.id
    ] = {
      creatingPoll: true,
      pollType: "district",
      step: "photo",
    };

    await ctx.reply(
      "📸 Надішліть фото для голосування"
    );
  }
);

//
// CUSTOM POLL
//
bot.action(
  "create_custom_poll",
  async (ctx) => {

    userStates[
      ctx.from.id
    ] = {
      creatingPoll: true,
      pollType: "custom",
      step: "photo",
    };

    await ctx.reply(
      "📸 Надішліть фото для голосування"
    );
  }
);

 

  //
  // PHOTO
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
          !state?.creatingPoll ||
          state.step !== "photo"
        ) {
          return next();
        }

        const photo =
          ctx.message.photo[
            ctx.message.photo.length - 1
          ];

        state.photoFileId =
          photo.file_id;

        state.step =
          "title";

        await ctx.reply(
          "📝 Введіть назву голосування"
        );

      } catch (error) {

        console.log(error);
      }
    }
  );

  //
  // TEXT
  //
  bot.on(
    "text",
    async (ctx, next) => {

      try {

        const state =
          userStates[
            ctx.from.id
          ];

        if (
          !state?.creatingPoll
        ) {
          return next();
        }

       //
// TITLE
//
if (
  state.step ===
  "title"
) {

  state.title =
    ctx.message.text;

  //
  // CUSTOM POLL
  //
  if (
    state.pollType ===
    "custom"
  ) {

    state.step =
      "options";

    return ctx.reply(
      "✏️ Введіть варіанти голосування\n\nКожен варіант з нового рядка"
    );
  }


  state.options =
    options;

  state.step =
    "voteType";

  return ctx.reply(
    "📊 Тип голосування",
    {
      reply_markup: {
        inline_keyboard: [

          [
            {
              text:
                "💸 Донатне",
              callback_data:
                "vote_type_donate"
            }
          ],

          [
            {
              text:
                "🆓 Безкоштовне",
              callback_data:
                "vote_type_free"
            }
          ]

        ]
      }
    }
  );
}

        //
// OPTIONS
//
if (
  state.step ===
  "options"
) {

  const options =
    ctx.message.text
      .split("\n")
      .map(
        (x) => x.trim()
      )
      .filter(Boolean);

  if (
    options.length < 2
  ) {

    return ctx.reply(
      "❌ Мінімум 2 варіанти"
    );
  }

  state.options =
    options;

  state.step =
    "voteType";

  return ctx.reply(
    "📊 Тип голосування",
    {
      reply_markup: {
        inline_keyboard: [

          [
            {
              text:
                "💸 Донатне",
              callback_data:
                "vote_type_donate"
            }
          ],

          [
            {
              text:
                "🆓 Безкоштовне",
              callback_data:
                "vote_type_free"
            }
          ]

        ]
      }
    }
  );
}
        //
  // DISTRICT POLL
  //
  state.step =
    "minutes";

  return ctx.reply(
    "⏱ Введіть час у хвилинах"
  );
}

        //
        // MINUTES
        //
        if (
          state.step ===
          "minutes"
        ) {

          const minutes =
            Number(
              ctx.message.text
            );

          if (!minutes) {

            return ctx.reply(
              "❌ Введіть число"
            );
          }

          //
          // CLOSE OLD POLL
          //
          await pool.query(`
            UPDATE polls
            SET is_active = false
          `);

          //
          // CLEAR VOTES
          //
          await pool.query(`
            DELETE FROM votes
          `);

          //
          // END TIME
          //
          const endTime =
            new Date(
              Date.now() +
              (
                minutes *
                60 *
                1000
              )
            );

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
          // TEXT
          //
          let text =
            `🏆 ${state.title}\n\n`;

          districtsResult.rows.forEach(
            (district) => {

              text +=
                `${district.emoji} ` +
                `${district.name} — 0\n`;
            }
          );

          text +=
            `\n\n⏱️ Залишилось: ${minutes} хв`;

          text +=
            `\n\n💸 1 грн = 1 голос`;

          //
          // SEND PHOTO POST
          //
          const message =
            await bot.telegram.sendPhoto(
              process.env.CHANNEL_ID,
              state.photoFileId,
              {
                caption: text,

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
              is_active,
              end_time,
              photo_file_id,
              message_type
            )
            VALUES (
              $1,
              $2,
              true,
              $3,
              $4,
              $5
            )
            `,
            [
              state.title,
              message.message_id,
              endTime,
              state.photoFileId,
              "photo"
            ]
          );

          delete userStates[
            ctx.from.id
          ];

          await ctx.reply(
            "✅ Голосування створено"
          );
        }

      } catch (error) {

        console.log(error);

        await ctx.reply(
          `❌ ${error.message}`
        );
      }
    }
  );

};

