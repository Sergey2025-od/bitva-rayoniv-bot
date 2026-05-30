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
      `);

    console.log(
      "LIVE POLL",
      poll
    );

    let text =
  `🏆 ${poll.title}\n\n`;

if (
  poll.tournament_stage
) {

  text +=
    `🏁 ${poll.tournament_stage} фіналу\n\n`;
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
          ORDER BY id
          `,
          [poll.id]
        );

      optionsResult.rows.forEach(
        (option) => {

          text +=
            `${option.title} — ${option.votes}\n`;
        }
      );

    } else {

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

    text +=
      `\n\n⏱️ Залишилось: ${leftMinutes} хв`;

    if (
      poll.vote_type ===
      "donate"
    ) {

      text +=
        `\n\n💸 1 грн = 1 голос`;
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
    }

  } catch (error) {

  if (
    error?.response?.description?.includes(
      "message is not modified"
    )
  ) {
    return;
  }

  console.log(error);
}
},
15000


);

};
