const pool =
  require("../database/db");

async function updateLeaderboard(
  bot
) {

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
  let leaderboard =
    `🏆 ${poll.title}\n\n`;

  for (
    const districtRow
    of districtsResult.rows
  ) {

    const totalRow =
      totalsResult.rows.find(
        (r) =>
          r.district ===
          districtRow.code
      );

    const total =
      totalRow
        ? totalRow.total
        : 0;

    leaderboard +=
      `${districtRow.emoji} ` +
      `${districtRow.name} — ${total}\n`;
  }

  //
  // TIMER
  //
  const leftMinutes =
    Math.max(
      0,
      Math.floor(
        (
          new Date(poll.end_time) -
          new Date()
        ) / 60000
      )
    );

  leaderboard +=
    `\n\n⏱ Залишилось: ${leftMinutes} хв`;

  leaderboard +=
    `\n\n💸 1 грн = 1 голос`;

  //
  // UPDATE POST
  //
  await bot.telegram.editMessageText(
    process.env.CHANNEL_ID,
    Number(poll.message_id),
    null,
    leaderboard,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text:
                "🗳 ПРОГОЛОСУВАТИ",

              url:
                "https://t.me/bitva_rayoniv_bot"
            }
          ]
        ]
      }
    }
  );
}

module.exports = {
  updateLeaderboard,
};