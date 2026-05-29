const pool =
  require("../database/db");

module.exports = (
  bot
) => {

  //
  // LIVE COUNTDOWN
  //
  setInterval(
    async () => {

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
          return;
        }

        //
        // TIME LEFT
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
          `);
console.log(
  "LIVE POLL",
  poll
);
        //
// BUILD TEXT
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
      ORDER BY id
      `,
      [poll.id]
    );

  optionsResult.rows.forEach(
    (option) => {

      text +=
  ` ${option.title} — ${option.votes}\n`;
    }
  );

} else {

  const districtsResult =
    await pool.query(`
      SELECT *
      FROM districts
      WHERE active = true
      ORDER BY id
    `);

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
          `\n\n⏱️ Залишилось: ` +

          `${leftMinutes} хв`;

        if (
  poll.vote_type ===
  "donate"
) {

  text +=
    `\n\n💸 1 грн = 1 голос`;
}

        //
        // UPDATE PHOTO CAPTION
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

      } catch (error) {

        console.log(error);
      }

    },
    15000
  );

};

