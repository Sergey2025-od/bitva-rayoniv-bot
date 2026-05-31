const pool = require("../database/db");

module.exports = (bot, userStates) => {

  // ─────────────────────────────────────────────
  // Отримуємо фото (скрін доната) — пересилаємо адміну
  // ─────────────────────────────────────────────
  bot.on("photo", async (ctx, next) => {
    try {
      const state = userStates[ctx.from.id];

      // Якщо немає стану — передаємо далі (може бути фото для турніру/голосування)
      if (!state?.district && !state?.customOption) {
        return next();
      }

      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;

      const username = ctx.from.username
        ? `@${ctx.from.username}`
        : ctx.from.first_name;

      // Формуємо caption і callback_data залежно від типу
      let caption;
      let callbackData;

      if (state.customOption) {
        caption =
          `🆕 Скрін доната\n\n` +
          `👤 ${username}\n\n` +
          `🏆 Варіант: ${state.customTitle}`;

        callbackData = `manual_option_${state.customOption}`;
      } else {
        caption =
          `🆕 Скрін доната\n\n` +
          `👤 ${username}\n\n` +
          `🏆 Район: ${state.districtEmoji} ${state.districtName}`;

        callbackData = `manual_vote_${state.district}`;
      }

      // Пересилаємо адміну з кнопкою "Додати голоси"
      await bot.telegram.sendPhoto(
        process.env.ADMIN_ID,
        fileId,
        {
          caption,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ Додати голоси",
                  callback_data: callbackData,
                },
              ],
            ],
          },
        }
      );

      // Очищаємо стан
      delete userStates[ctx.from.id];

      await ctx.reply("✅ Скрін відправлено адміну. Голоси зарахують після перевірки.");

    } catch (error) {
      console.log(error);
    }
  });
};
