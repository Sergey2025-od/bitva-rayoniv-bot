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
    text += `🏁 Голосування завершено\n\n`;
    text += `📊 Фінальні результати:\n\n`;

    rows.forEach((option, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "▫️";
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

  text += `🏁 Голосування завершено\n\n`;
  text += `📊 Фінальні результати:\n\n`;

  // Всі райони з балами
  districtsResult.rows.forEach((district) => {
    const row = totalsResult.rows.find((r) => r.district === district.code);
    const total = row ? row.total : 0;
    text += `${district.emoji} ${district.name} — ${total} голосів\n`;
  });

  text += "\n";

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
// Оригінальний пост не чіпаємо.
// ─────────────────────────────────────────────
async function publishResults(bot, poll) {
  const resultsText = await buildResultsText(poll);

  await bot.telegram.sendMessage(
    process.env.CHANNEL_ID,
    resultsText
  );

  console.log("✅ Results posted to channel");
}

module.exports = { publishResults };
