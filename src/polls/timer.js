const pool =
require("../database/db");

module.exports = (
bot
) => {

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

    if (
      new Date() <
      new Date(
        poll.end_time
      )
    ) {
      return;
    }

    console.log(
      "AUTO FINISH",
      poll
    );

    await pool.query(`
      UPDATE polls
      SET is_active = false
      WHERE id = ${poll.id}
    `);

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

    let districtsResult;

    if (
      poll.tournament_districts
    ) {

      districtsResult =
        await pool.query(
          `
          SELECT *
          FROM districts
          WHERE code = ANY($1)
          ORDER BY id
          `,
          [
            poll.tournament_districts
              .split(",")
          ]
        );

    } else {

      districtsResult =
        await pool.query(`
          SELECT *
          FROM districts
          WHERE active = true
          ORDER BY id
        `);
    }

    const map = {};

    districtsResult.rows.forEach(
      (district) => {

        map[
          district.code
        ] = district;
      }
    );

    let text =
  `🏆 ${poll.title}\n\n`;

if (
  poll.tournament_stage
) {

  if (
    poll.tournament_stage
      .toLowerCase() ===
    "фінал"
  ) {

    text +=
      `🏁 Фінал\n\n`;

  } else {

    text +=
      `🏁 ${poll.tournament_stage} фіналу\n\n`;
  }
}

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
            `${district.emoji} ${district.name} — ${total}\n`;
        }
      );
    }

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

      text +=
        `\n❤️ Дякуємо всім за участь у голосуванні`;

    } else {

      if (
  poll.tournament_stage &&
  poll.tournament_stage
    .toLowerCase() ===
  "фінал"
) {

  if (
    totalsResult.rows[0]
  ) {

    const winner =
      map[
        totalsResult.rows[0]
          .district
      ];

    if (winner) {

      text +=
        `\n🏆 ЧЕМПІОН ТУРНІРУ\n\n` +
        `${winner.emoji} ${winner.name}\n` +
        `💪 ${totalsResult.rows[0].total} голосів\n\n` +
        `🎉 Вітаємо переможця!\n`;
    }
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

    if (winner) {

      text +=
        `\n🥇 Переможець\n` +
        `${winner.emoji} ${winner.name} — ${totalsResult.rows[0].total} голосів\n`;
    }
  }

  if (
    totalsResult.rows[1]
  ) {

    const second =
      map[
        totalsResult.rows[1]
          .district
      ];

    if (second) {

      text +=
        `\n🥈 2 місце\n` +
        `${second.emoji} ${second.name} — ${totalsResult.rows[1].total} голосів\n`;
    }
  }

  if (
    totalsResult.rows[2]
  ) {

    const third =
      map[
        totalsResult.rows[2]
          .district
      ];

    if (third) {

      text +=
        `\n🥉 3 місце\n` +
        `${third.emoji} ${third.name} — ${totalsResult.rows[2].total} голосів\n`;
    }
  }
}

      text +=
        `\n❤️ Дякуємо всім за участь у битві за свій район`;
    }

    if (
      poll.message_type ===
      "photo"
    ) {

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

    } else {

      await bot.telegram.editMessageText(
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
    }

    console.log(
      "🏁 POLL AUTO FINISHED"
    );

  } catch (error) {

    console.log(error);
  }

},
15000


);

};
