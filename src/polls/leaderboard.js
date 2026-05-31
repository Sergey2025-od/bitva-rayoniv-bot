const pool = require("../database/db");

async function updateLeaderboard(bot) {
  const pollResult = await pool.query(`
    SELECT * FROM polls
    WHERE is_active = true
    ORDER BY id DESC
    LIMIT 1
  `);

  const poll = pollResult.rows[0];
  if (!poll) return;

  // ─────────────────────────────────────────────
  // Будуємо текст для кастомного голосування
  // ─────────────────────────────────────────────
  if (poll.poll_type === "custom") {
    const optionsResult = await pool.query(`
      SELECT * FROM poll_options
      WHERE poll_id = $1
      ORDER BY id
    `, [poll.id]);

    let leaderboard = `🏆 ${poll.title}\n\n`;

    optionsResult.rows.forEach((option) => {
      leaderboard += `🔹 ${option.title} — ${option.votes}\n`;
    });

    leaderboard += buildTimerLine(poll);

    if (poll.vote_type === "donate") {
      leaderboard += `\n\n💸 1 грн = 1 голос`;
    }

    await editPost(bot, poll, leaderboard);
    return;
  }

  // ─────────────────────────────────────────────
  // Будуємо текст для голосування по районах
  // ─────────────────────────────────────────────
  const totalsResult = await pool.query(`
    SELECT district, SUM(amount) as total
    FROM votes
    WHERE status = 'approved'
    GROUP BY district
  `);

  let districtsResult;

  if (poll.tournament_districts) {
    districtsResult = await pool.query(`
      SELECT * FROM districts
      WHERE code = ANY($1)
      ORDER BY id
    `, [poll.tournament_districts.split(",")]);
  } else {
    districtsResult = await pool.query(`
      SELECT * FROM districts
      WHERE active = true
      ORDER BY id
    `);
  }

  let leaderboard = `🏆 ${poll.title}\n\n`;

  // Стадія турніру (якщо є)
  if (poll.tournament_stage) {
    if (poll.tournament_stage.toLowerCase() === "фінал") {
      leaderboard += `🏁 Фінал\n\n`;
    } else {
      leaderboard += `🏁 ${poll.tournament_stage} фіналу\n\n`;
    }
  }

  for (const district of districtsResult.rows) {
    const totalRow = totalsResult.rows.find(
      (r) => r.district === district.code
    );
    const total = totalRow ? totalRow.total : 0;

    leaderboard += `${district.emoji} ${district.name} — ${total}\n`;
  }

  leaderboard += buildTimerLine(poll);
  leaderboard += `\n\n💸 1 грн = 1 голос`;

  await editPost(bot, poll, leaderboard);
}

// ─────────────────────────────────────────────
// Рядок з таймером
// ─────────────────────────────────────────────
function buildTimerLine(poll) {
  const leftMinutes = Math.max(
    0,
    Math.floor((new Date(poll.end_time) - new Date()) / 60000)
  );
  return `\n\n⏱️ Залишилось: ${leftMinutes} хв`;
}

// ─────────────────────────────────────────────
// Редагуємо пост в каналі (фото або текст)
// ─────────────────────────────────────────────
async function editPost(bot, poll, text) {
  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: "🗳 ПРОГОЛОСУВАТИ",
          url: "https://t.me/bitva_rayoniv_bot?start=vote",
        },
      ],
    ],
  };

  if (poll.message_type === "photo") {
    await bot.telegram.editMessageCaption(
      process.env.CHANNEL_ID,
      Number(poll.message_id),
      null,
      text,
      { reply_markup: replyMarkup }
    );
  } else {
    await bot.telegram.editMessageText(
      process.env.CHANNEL_ID,
      Number(poll.message_id),
      null,
      text,
      { reply_markup: replyMarkup }
    );
  }
}

module.exports = { updateLeaderboard };
