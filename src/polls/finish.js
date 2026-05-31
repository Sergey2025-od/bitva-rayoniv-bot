const pool = require("../database/db");
const { buildFinishText, editPost } = require("./timer");

module.exports = (bot) => {

  bot.action("admin_finish_poll", async (ctx) => {

    try {

      const pollResult = await pool.query(`
        SELECT *
        FROM polls
        WHERE is_active = true
        ORDER BY id DESC
        LIMIT 1
      `);

      const poll = pollResult.rows[0];

      if (!poll) {
        return ctx.reply("❌ Немає активного голосування");
      }

      console.log("FINISH POLL", poll);

      await pool.query(`
        UPDATE polls SET is_active = false WHERE id = $1
      `, [poll.id]);

      const text = await buildFinishText(poll);

      await editPost(bot, poll, text, []); // inline_keyboard: [] — кнопка прибрана

      await ctx.reply("🏁 Голосування завершено");

    } catch (error) {
      console.log(error);
    }

  });

};
