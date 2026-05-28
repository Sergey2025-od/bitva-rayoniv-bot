const { Markup } =
  require("telegraf");

function adminKeyboard() {

  return Markup.inlineKeyboard([

    [
      Markup.button.callback(
        "🆕 Створити голосування",
        "admin_create_poll"
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
        "📈 Статистика",
        "admin_stats"
      ),
    ],

  ]);
}

module.exports = {
  adminKeyboard,
};