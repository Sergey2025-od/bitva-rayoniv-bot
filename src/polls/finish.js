const pool =
  require("../database/db");

module.exports = (
  bot
) => {

  bot.action(
    "admin_finish_poll",
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
              COALESCE(
                SUM(amount),
                0
              ) as total
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

        //
        // MAP
        //
        const map = {};

        districtsResult.rows.forEach(
          (district) => {

            map[
              district.code
            ] = district;
          }
        );

        //
// KEEP ORIGINAL POST
//
let text =
  `🏆 ${poll.title}\n\n`;

if (
  poll.poll_type ===
  "custom"
) {

  const optionsResult =
    await pool.query(
      `
      SELECT *
      FROM poll_options
      WHERE poll_id = $1
      ORDER BY votes DESC, id
      `,
      [poll.id]
    );

  optionsResult.rows.forEach(
    (option) => {

      text +=
        `🔹 ${option.title} — ${option.votes}\n`;
    }
  );

} else {

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
}

        //
        // FINAL BLOCK
        //
        text +=
          `\n\n🏁 Голосування завершено`;

        text +=
          `\n\n📊 Фінальні результати:\n`;

       if (
  poll.poll_type ===
  "custom"
) {

  const optionsResult =
    await pool.query(
      `
      SELECT *
      FROM poll_options
      WHERE poll_id = $1
      ORDER BY votes DESC, id
      `,
      [poll.id]
    );

  if (optionsResult.rows[0]) {

    text +=
      `\n🥇 Переможець\n` +
      `${optionsResult.rows[0].title} — ${optionsResult.rows[0].votes} голосів\n`;
  }

  if (optionsResult.rows[1]) {

    text +=
      `\n🥈 2 місце\n` +
      `${optionsResult.rows[1].title} — ${optionsResult.rows[1].votes} голосів\n`;
  }

  if (optionsResult.rows[2]) {

    text +=
      `\n🥉 3 місце\n` +
      `${optionsResult.rows[2].title} — ${optionsResult.rows[2].votes} голосів\n`;
  }

} else {

  if (
    totalsResult.rows[0]
  ) {

    const winner =
      map[
        totalsResult.rows[0]
          .district
      ];

    text +=
      `\n🥇 Переможець\n` +
      `${winner.emoji} ${winner.name} — ${totalsResult.rows[0].total} голосів\n`;
  }

  if (
    totalsResult.rows[1]
  ) {

    const second =
      map[
        totalsResult.rows[1]
          .district
      ];

    text +=
      `\n🥈 2 місце\n` +
      `${second.emoji} ${second.name} — ${totalsResult.rows[1].total} голосів\n`;
  }

  if (
    totalsResult.rows[2]
  ) {

    const third =
      map[
        totalsResult.rows[2]
          .district
      ];

    text +=
      `\n🥉 3 місце\n` +
      `${third.emoji} ${third.name} — ${totalsResult.rows[2].total} голосів\n`;
  }
}

        //
// THANKS
//
if (
  poll.poll_type ===
  "custom"
) {

  text +=
    `\n❤️ Дякуємо всім за участь у голосуванні`;

} else {

  text +=
    `\n❤️ Дякуємо всім за участь у битві за свій район`;
}

        //
        // UPDATE POST
        //
        await bot.telegram.editMessageCaption(
          process.env.CHANNEL_ID,
          Number(
            poll.message_id
          ),
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

