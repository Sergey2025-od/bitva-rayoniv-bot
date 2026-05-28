const pool =
  require("../database/db");

module.exports = (
  bot
) => {

  //
  // AUTO FINISH
  //
  setInterval(
    async () => {

      try {

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
          return;
        }

        //
        // NOT ENDED
        //
        if (
          new Date() <
          new Date(
            poll.end_time
          )
        ) {
          return;
        }

        //
        // CLOSE POLL
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
        // BUILD TEXT
        //
        const top =
          totalsResult.rows;

        let resultText =
          `🏁 Голосування завершено\n\n`;

        if (top[0]) {

          resultText +=
            `🥇 ${map[top[0].district]?.emoji || ""} ` +
            `${map[top[0].district]?.name || top[0].district} — ${top[0].total}\n`;
        }

        if (top[1]) {

          resultText +=
            `🥈 ${map[top[1].district]?.emoji || ""} ` +
            `${map[top[1].district]?.name || top[1].district} — ${top[1].total}\n`;
        }

        if (top[2]) {

          resultText +=
            `🥉 ${map[top[2].district]?.emoji || ""} ` +
            `${map[top[2].district]?.name || top[2].district} — ${top[2].total}\n`;
        }

        //
        // UPDATE POST
        //
        await bot.telegram.editMessageText(
          process.env.CHANNEL_ID,
          Number(poll.message_id),
          null,
          resultText
        );

        console.log(
          "🏁 POLL FINISHED"
        );

      } catch (error) {

        console.log(error);
      }

    },
    15000
  );

};