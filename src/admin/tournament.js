const pool =
  require("../database/db");

module.exports = (
  bot,
  userStates
) => {

  //
  // OPEN TOURNAMENT CREATOR
  //
  bot.action(
    "admin_create_tournament",
    async (ctx) => {

      userStates[
        ctx.from.id
      ] = {

        creatingTournament: true,

        step:
          "stage",
      };

      await ctx.reply(
        `🏆 Створення турніру\n\n` +

        `Введіть стадію:\n\n` +

        `1/8\n` +
        `1/4\n` +
        `Півфінал\n` +
        `Фінал`
      );
    }
  );

  //
  // TOURNAMENT FLOW
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

        const state =
          userStates[
            ctx.from.id
          ];

        if (
          !state?.creatingTournament
        ) {
          return next();
        }

        //
        // STAGE
        //
        if (
          state.step ===
          "stage"
        ) {

          state.stage =
            ctx.message.text;

          state.step =
            "title";

          return ctx.reply(
            "📝 Введіть назву турніру"
          );
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

          state.minutes =
            minutes;

          state.step =
            "districts";

          //
          // SHOW DISTRICTS
          //
          const districtsResult =
            await pool.query(`
              SELECT *
              FROM districts
              WHERE active = true
              ORDER BY id
            `);

          let text =
            `🏆 Оберіть райони\n\n`;

          districtsResult.rows.forEach(
            (district) => {

              text +=
                `${district.code} — ` +
                `${district.emoji} ` +
                `${district.name}\n`;
            }
          );

          text +=
            `\nВведіть коди через кому\n\n` +

            `Наприклад:\n` +

            `tairova,center`;

          return ctx.reply(
            text
          );
        }

        //
        // DISTRICTS
        //
        if (
          state.step ===
          "districts"
        ) {

          const districts =
            ctx.message.text
              .split(",")
              .map(
                (d) =>
                  d.trim()
              );

          //
          // SAVE
          //
          state.districts =
            districts;

          //
          // END TIME
          //
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
          // GET DISTRICTS
          //
          const districtsResult =
            await pool.query(
              `
              SELECT *
              FROM districts
              WHERE code = ANY($1)
              `,
              [districts]
            );

          //
          // BUILD TEXT
          //
          let text =
            `🏆 ${state.title}\n\n`;

          text +=
            `🎯 ${state.stage}\n\n`;

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
  end_time,
  tournament_stage,
  tournament_districts
)
            VALUES (
              $1,
              $2,
              true,
              $3,
              $4
            )
            `,
            [
  state.title,
  message.message_id.toString(),
  endTime,
  state.stage,
  state.districts.join(",")
]
          );

          //
          // FINISH
          //
          delete userStates[
            ctx.from.id
          ];

          await ctx.reply(
            "✅ Турнір створено"
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
