const { Markup } =
require("telegraf");

module.exports = (
bot
) => {

bot.command(
"admin",
async (ctx) => {


  const ADMIN_ID =
    process.env.ADMIN_ID;

  if (
    ctx.from.id.toString() !==
    ADMIN_ID
  ) {
    return;
  }

  await ctx.reply(
    "⚙️ Адмін панель",

    Markup.inlineKeyboard([

      [
        Markup.button.callback(
  "🆕 Створити голосування",
  "admin_poll_type"
),
      ],

      [
        Markup.button.callback(
          "📊 Поточне голосування",
          "admin_current_poll"
        ),
      ],

      [
        Markup.button.callback(
          "➕ Додати голоси",
          "admin_add_votes"
        ),
      ],

      [
        Markup.button.callback(
          "🏁 Завершити голосування",
          "admin_finish_poll"
        ),
      ],

      [
        Markup.button.callback(
          "🏆 Створити турнір",
          "admin_create_tournament"
        ),
      ],

    ])
  );
}


);

};
