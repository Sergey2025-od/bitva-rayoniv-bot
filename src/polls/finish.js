```javascript
const pool =
  require("../database/db");

module.exports = (
  bot
) => {

  bot.action(
    "admin_finish_poll",
    async (ctx) => {

      try {

        const pollResult =
          await pool.query(`
            SELECT *
            FROM polls
            ORDER BY id DESC
            LIMIT 1
          `);

        const poll =
          pollResult.rows[0];

        if (!poll) {

          return ctx.reply(
            "❌ Немає голосування"
          );
        }

        if (!poll.is_active) {

          return ctx.reply(
            "⚠️ Голосування вже завершене"
          );
        }

        //
        // CLOSE
        //
        await pool.query(`
          UPDATE polls
          SET is_active = false
          WHERE id = ${poll.id}
        `);

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
            ORDER BY total DESC
          `);

        //
        // DISTRICTS
        //
        const districtsResult =
          await pool.query(`
            SELECT *
            FROM districts
          `);

        const map = {};

        districtsResult.rows.forEach(
          (d) => {

            map[d.code] = d;
          }
        );

        //
        // RESULT TEXT
        //
        let resultText =
          `🏁 Голосування завершено\n\n`;

        totalsResult.rows.forEach(
          (row, index) => {

            const district =
              map[row.district];

            const medal =
              index === 0
                ? "🥇"
                : index === 1
                ? "🥈"
                : index === 2
                ? "🥉"
                : "🏆";

            resultText +=
              `${medal} ` +
              `${district?.emoji || ""} ` +
              `${district?.name || row.district} — ${row.total}\n`;
          }
        );

        //
        // UPDATE POST
        //
        await bot.telegram.editMessageText(
          process.env.CHANNEL_ID,
          Number(poll.message_id),
          null,
          resultText
        );

        await ctx.reply(
          "🏁 Голосування завершено"
        );

      } catch (error) {

        console.log(error);
      }
    }
  );
};
```
