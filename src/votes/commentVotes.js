const pool =
  require("../database/db");

module.exports = (
  bot
) => {

  //
  // COMMENT DONATE
  //
  bot.action(
    /vote_comment_(.+)/,
    async (ctx) => {

      try {

        const district =
          ctx.match[1];

        //
        // GET DISTRICT
        //
        const districtResult =
          await pool.query(
            `
            SELECT *
            FROM districts
            WHERE code = $1
            LIMIT 1
            `,
            [district]
          );

        const districtData =
          districtResult.rows[0];

        if (!districtData) {

          return ctx.reply(
            "❌ Район не знайдено"
          );
        }

        //
        // MONO LINK
        //
        const donateUrl =
          `https://send.monobank.ua/jar/3NysFcAawr`;

        //
        // MESSAGE
        //
        await ctx.reply(
          `💳 Донат з коментарем\n\n` +

          `🏆 Район:\n` +

          `${districtData.emoji} ` +
          `${districtData.name}\n\n` +

          `⚠️ У коментарі до платежу напишіть:\n\n` +

          `${districtData.name}\n\n` +

          `💸 1 грн = 1 голос`,

          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text:
                      "💳 ВІДКРИТИ MONO",

                    url:
                      donateUrl
                  }
                ]
              ]
            }
          }
        );

      } catch (error) {

        console.log(error);
      }
    }
  );

};