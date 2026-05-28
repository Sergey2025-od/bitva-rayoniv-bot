const {
  adminKeyboard,
} = require(
  "../keyboards/adminKeyboard"
);

function registerAdminPanel(
  bot,
  ADMIN_ID
) {

  bot.command(
    "admin",
    async (ctx) => {

      if (
        ctx.from.id.toString() !==
        ADMIN_ID
      ) {
        return;
      }

      await ctx.reply(
        "⚙️ Адмін-панель",
        adminKeyboard()
      );
    }
  );
}

module.exports = {
  registerAdminPanel,
};