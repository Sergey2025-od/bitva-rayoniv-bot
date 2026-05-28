const pool =
  require("../database/db");

module.exports = (
  bot
) => {

  bot.action(
    "admin_current_poll",
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
            "❌ Немає активного голосування"
          );
        }

        //
        // TOTALS
        //
        const totalsResult =
          await pool.query(`
            SELECT
              district,
              SUM(amount) as total
            FROM votes
            WHERE status = 'approved'
            GROUP BY district
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

        //
        // TIMER
        //
        const leftMinutes =
          Math.max(
            0,
            Math.floor(
              (
                new Date(
                  poll.end_time
                ) -
                new Date()
              ) / 60000
            )
          );

        text +=
          `\n\n⏱ Залишилось: ${leftMinutes} хв`;

        await ctx.reply(
          text
        );

      } catch (error) {

        console.log(error);
      }
    }
  );

};