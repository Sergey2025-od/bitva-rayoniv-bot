const pool =
  require("../database/db");

module.exports = (
  bot,
  userStates
) => {

  bot.action(
    "admin_create_poll",
    async (ctx) => {

      userStates[
        ctx.from.id
      ] = {
        creatingPoll: true,
        step: "title",
      };

      await ctx.reply(
        "📝 Введіть назву голосування"
      );
    }
  );

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
          // CLOSE OLD
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
          // BUILD TEXT
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
              {
                source:
                  "./assets/Vote.png"
              },
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
              end_time
            )
            VALUES (
              $1,
              $2,
              true,
              $3
            )
            `,
            [
              state.title,
              message.message_id,
              endTime,
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

