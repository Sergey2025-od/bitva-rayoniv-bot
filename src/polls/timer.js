const pool = require("../database/db");
const { publishResults } = require("./results");

module.exports = (bot) => {

  setInterval(async () => {
    try {

      // Знаходимо активне голосування
      const pollResult = await pool.query(`
        SELECT * FROM polls
        WHERE is_active = true
        ORDER BY id DESC
        LIMIT 1
      `);

      const poll = pollResult.rows[0];

      if (!poll) return;

      // Ще не час
      if (new Date() < new Date(poll.end_time)) return;

      console.log("⏰ AUTO FINISH", poll.id, poll.title);

      // Завершуємо голосування
      await pool.query(`
        UPDATE polls SET is_active = false WHERE id = $1
      `, [poll.id]);

      // Надсилаємо новий пост з результатами в канал
      await publishResults(bot, poll);

      console.log("✅ POLL AUTO FINISHED");

    } catch (error) {
      console.log("❌ TIMER ERROR:", error.message);
    }
  }, 15000);

};
