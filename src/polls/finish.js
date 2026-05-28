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
        ORDER BY id
      `);

    const map = {};

    districtsResult.rows.forEach(
      (d) => {

        map[d.code] = d;
      }
    );

    //
    // KEEP LEADERBOARD
    //
    let resultText =
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

        resultText +=
          `${district.emoji} ` +
          `${district.name} — ${total}\n`;
      }
    );

    //
    // FINAL
    //
    resultText +=
      `\n\n🏁 ГОЛОСУВАННЯ ЗАВЕРШЕНО\n`;

    if (totalsResult.rows[0]) {

      const d =
        map[
          totalsResult.rows[0]
            .district
        ];

      resultText +=
        `\n🥇 Переможець:\n` +

        `${d.emoji} ` +
        `${d.name} — ` +

        `${totalsResult.rows[0].total} голосів\n`;
    }

    if (totalsResult.rows[1]) {

      const d =
        map[
          totalsResult.rows[1]
            .district
        ];

      resultText +=
        `\n🥈 2 місце:\n` +

        `${d.emoji} ` +
        `${d.name} — ` +

        `${totalsResult.rows[1].total} голосів\n`;
    }

    if (totalsResult.rows[2]) {

      const d =
        map[
          totalsResult.rows[2]
            .district
        ];

      resultText +=
        `\n🥉 3 місце:\n` +

        `${d.emoji} ` +
        `${d.name} — ` +

        `${totalsResult.rows[2].total} голосів\n`;
    }

    //
    // UPDATE POST
    //
    await bot.telegram.editMessageText(
      process.env.CHANNEL_ID,
      Number(poll.message_id),
      null,
      resultText,
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
