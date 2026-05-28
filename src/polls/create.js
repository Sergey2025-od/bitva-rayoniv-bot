const pool =
  require("../database/db");

module.exports = (
  bot,
  userStates
) => {

  bot.action(
    "admin_create_poll",
    async (ctx) => {

      const ADMIN_ID =
        process.env.ADMIN_ID;

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

  //
  // CREATE POLL
  //
  bot.on(
    "message",
    async (ctx, next) => {

      try {

        if (
          !ctx.message.text
        ) {
          return next();
        }

        if (
          ctx.message.text.startsWith("/")
        ) {
          return next();
        }

        const state =
          userStates[
            ctx.from.id
          ];

        if (
          !state?.creatingVote
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
            "⏱ Введіть час голосування у хвилинах"
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

          state.minutes =
            minutes;

          state.step =
            "create";
        }

        //
        // READY
        //
        if (
          state.step !==
          "create"
        ) {
          return next();
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
          `🏆 ${title}\n\n`;

        districtsResult.rows.forEach(
          (district) => {

            text +=
              `${district.emoji} ` +
              `${district.name} — 0\n`;
          }
        );

        text +=
          `\n\n⏱ Залишилось: ${state.minutes} хв`;

        text +=
          `\n\n💸 1 грн = 1 голос`;

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

        delete userStates[
          ctx.from.id
        ];

        await ctx.reply(
          "✅ Голосування створено."
        );

      } catch (error) {

        console.log(error);

        await ctx.reply(
          `❌ ${error.message}`
        );
      }
    }
  );
};
