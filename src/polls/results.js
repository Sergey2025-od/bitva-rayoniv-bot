const pool = require("../database/db");

// ─────────────────────────────────────────────
// Будує текст нового поста з результатами
// ─────────────────────────────────────────────
async function buildResultsText(poll) {

  // ── CUSTOM POLL ──
  if (poll.poll_type === "custom") {
    const optionsResult = await pool.query(`
      SELECT * FROM poll_options
      WHERE poll_id = $1
      ORDER BY votes DESC, id
    `, [poll.id]);

    const rows = optionsResult.rows;

    let text = `🏆 ${poll.title}\n\n`;
    text += `🏁 Голосування завершено!\n\n`;

    const top3 = rows.slice(0, 3);
    top3.forEach((option, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      text += `${medal} ${option.title} — ${option.votes} голосів\n`;
    });

    text += `\n❤️ Дякуємо всім за участь!`;
    return text;
  }

  // ── DISTRICT / TOURNAMENT POLL ──
  const totalsResult = await pool.query(`
    SELECT
      district,
      COALESCE(SUM(amount), 0) as total
    FROM votes
    WHERE status = 'approved'
    GROUP BY district
    ORDER BY total DESC
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

  // Мапа код → район
  const map = {};
  districtsResult.rows.forEach((d) => { map[d.code] = d; });

  let text = `🏆 ${poll.title}\n\n`;

  if (poll.tournament_stage) {
    text += poll.tournament_stage.toLowerCase() === "фінал"
      ? `🏁 Фінал\n\n`
      : `🏁 ${poll.tournament_stage} фіналу\n\n`;
  }

  text += `🏁 Голосування завершено!\n\n`;

  // Топ переможців
  if (poll.tournament_stage && poll.tournament_stage.toLowerCase() === "фінал") {
    const winner = totalsResult.rows[0] && map[totalsResult.rows[0].district];
    if (winner) {
      text +=
        `🏆 ЧЕМПІОН ТУРНІРУ\n\n` +
        `${winner.emoji} ${winner.name}\n` +
        `💪 ${totalsResult.rows[0].total} голосів\n\n` +
        `🎉 Вітаємо переможця!\n`;
    }
  } else {
    const w0 = totalsResult.rows[0] && map[totalsResult.rows[0].district];
    const w1 = totalsResult.rows[1] && map[totalsResult.rows[1].district];
    const w2 = totalsResult.rows[2] && map[totalsResult.rows[2].district];

    if (w0) text += `🥇 ${w0.emoji} ${w0.name} — ${totalsResult.rows[0].total} голосів\n`;
    if (w1) text += `🥈 ${w1.emoji} ${w1.name} — ${totalsResult.rows[1].total} голосів\n`;
    if (w2) text += `🥉 ${w2.emoji} ${w2.name} — ${totalsResult.rows[2].total} голосів\n`;
  }

  text += `\n❤️ Дякуємо всім за участь у битві за свій район!`;
  return text;
}

// ─────────────────────────────────────────────
// Надсилає НОВИЙ пост з результатами у канал.
// Зі старого поста видаляє кнопку голосування.
// ─────────────────────────────────────────────
async function publishResults(bot, poll) {
  // 1. Прибираємо кнопку "Проголосувати" зі старого поста
  if (poll.message_id) {
    const msgId = Number(poll.message_id);
    const channelId = process.env.CHANNEL_ID;

    console.log(`🔧 Removing button from message_id=${msgId}, type=${poll.message_type}, channel=${channelId}`);

    try {
      if (poll.message_type === "photo") {
        // Фото-пост: editMessageCaption прибирає кнопку і замінює текст
        await bot.telegram.editMessageCaption(
          channelId,
          msgId,
          null,
          `🏁 ${poll.title}\n\nГолосування завершено. Результати у наступному повідомленні 👇`,
          { reply_markup: { inline_keyboard: [] } }
        );
        console.log("✅ Vote button removed from photo post");
      } else {
        // Текстовий пост: editMessageReplyMarkup
        await bot.telegram.editMessageReplyMarkup(
          channelId,
          msgId,
          null,
          { inline_keyboard: [] }
        );
        console.log("✅ Vote button removed from text post");
      }
    } catch (err) {
      console.log("⚠️ First attempt failed:", err.message);
      // Запасний варіант — спробувати editMessageReplyMarkup незалежно від типу
      try {
        await bot.telegram.editMessageReplyMarkup(
          channelId,
          msgId,
          null,
          { inline_keyboard: [] }
        );
        console.log("✅ Vote button removed (fallback)");
      } catch (err2) {
        console.log("❌ Both attempts failed:", err2.message);
        console.log("❌ Check: is bot an admin in channel with 'Edit messages' permission?");
      }
    }
  }

  // 2. Публікуємо новий пост з результатами
  const resultsText = await buildResultsText(poll);

  await bot.telegram.sendMessage(
    process.env.CHANNEL_ID,
    resultsText
  );

  console.log("✅ Results posted to channel");
}

module.exports = { publishResults };
