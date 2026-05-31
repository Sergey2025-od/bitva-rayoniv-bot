const pool = require("../database/db");
const { publishResults } = require("./results");

module.exports = (bot) => {

  bot.action("admin_finish_poll", async (ctx) => {
    try {

      // Знаходимо активне голосування
      const pollResult = await pool.query(`
        SELECT * FROM polls
        WHERE is_active = true
        ORDER BY id DESC
        LIMIT 1
      `);

      const poll = pollResult.rows[0];

      if (!poll) {
        return ctx.reply("❌ Немає активного голосування");
      }

      // Завершуємо голосування
      await pool.query(`
        UPDATE polls SET is_active = false WHERE id = $1
      `, [poll.id]);

      // Надсилаємо новий пост з результатами в канал
      await publishResults(bot, poll);

      await ctx.reply("🏁 Голосування завершено. Результати опубліковано в каналі.");

    } catch (error) {
      console.log(error);
      await ctx.reply(`❌ Помилка: ${error.message}`);
    }
  });

};
