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
        WHERE active = true
        ORDER BY id
      `);

    const map = {};

    districtsResult.rows.forEach(
      (d) => {

        map[d.code] = d;
      }
    );

    //
    // MAIN TEXT
    //
    let text =
      `🏆 ${poll.title}\n\n`;

    districtsResult.rows.forEach(
      (district) => {

        const row =
          totalsResult.rows.find(
            (r) =>
              r.district ===
              district.code
          );

        const total =
          row
            ? row.total
            : 0;

        text +=
          `${district.emoji} ` +
          `${district.name} — ${total}\n`;
      }
    );

    //
    // FINAL
    //
    text +=
      `\n\n🏁 ГОЛОСУВАННЯ ЗАВЕРШЕНО`;

    //
    // TOP 1
    //
    if (totalsResult.rows[0]) {

      const winner =
        map[
          totalsResult.rows[0]
            .district
        ];

      text +=
        `\n\n🥇 Переможець\n` +

        `${winner.emoji} ` +
        `${winner.name} — ` +

        `${totalsResult.rows[0].total} голосів`;
    }

    //
    // TOP 2
    //
    if (totalsResult.rows[1]) {

      const second =
        map[
          totalsResult.rows[1]
            .district
        ];

      text +=
        `\n\n🥈 2 місце\n` +

        `${second.emoji} ` +
        `${second.name} — ` +

        `${totalsResult.rows[1].total} голосів`;
    }

    //
    // TOP 3
    //
    if (totalsResult.rows[2]) {

      const third =
        map[
          totalsResult.rows[2]
            .district
        ];

      text +=
        `\n\n🥉 3 місце\n` +

        `${third.emoji} ` +
        `${third.name} — ` +

        `${totalsResult.rows[2].total} голосів`;
    }

    //
    // UPDATE POST
    //
    await bot.telegram.editMessageText(
      process.env.CHANNEL_ID,
      Number(poll.message_id),
      null,
      text,
      {
        reply_markup: {
          inline_keyboard: []
        }
      }
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
