const pool =
  require("../database/db");

const {
  updateLeaderboard,
} = require(
  "../polls/leaderboard"
);

module.exports = (
  bot,
  userStates
) => {

  //
  // OPEN MANUAL VOTE
  //
  bot.action(
    /manual_vote_(.+)/,
    async (ctx) => {

      const district =
        ctx.match[1];

      userStates[
        ctx.from.id
      ] = {
        addingVotes: true,
        district,
      };

      await ctx.reply(
        "💸 Введіть кількість голосів"
      );
    }
  );

  //
  // SAVE MANUAL VOTE
  //
  bot.hears(
    /^\d+$/,
    async (ctx, next) => {

      try {

        const state =
          userStates[
            ctx.from.id
          ];

        if (
          !state?.addingVotes
        ) {
          return next();
        }

        const amount =
          Number(
            ctx.message.text
          );

        if (!amount) {

          return ctx.reply(
            "❌ Введіть число"
          );
        }

        //
        // SAVE
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
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'approved'
          )
          `,
          [
            "admin",
            "admin",
            state.district,
            amount,
          ]
        );

        //
        // UPDATE POST
        //
        await updateLeaderboard(
          bot
        );

        delete userStates[
          ctx.from.id
        ];

        await ctx.reply(
          "✅ Голоси додано"
        );

      } catch (error) {

        console.log(error);
      }
    }
  );

};