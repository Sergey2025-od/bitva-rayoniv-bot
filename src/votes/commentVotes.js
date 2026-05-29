const pool =
require("../database/db");

module.exports = (
bot
) => {

//
// CUSTOM COMMENT DONATE
//
bot.action(
/vote_comment_option_(.+)/,
async (ctx) => {

try {


const optionId =
  ctx.match[1];

const optionResult =
  await pool.query(
    `
    SELECT *
    FROM poll_options
    WHERE id = $1
    LIMIT 1
    `,
    [optionId]
  );

const option =
  optionResult.rows[0];

if (!option) {

  return ctx.reply(
    "❌ Варіант не знайдено"
  );
}

const donateUrl =
  `https://send.monobank.ua/jar/3NysFcAawr`;

await ctx.reply(
  `💳 Донат з коментарем\n\n` +

  `🏆 Варіант:\n\n` +

  `${option.title}\n\n` +

  `⚠️ У коментарі до платежу напишіть:\n\n` +

  `${option.code}\n\n` +

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

//
// DISTRICT COMMENT DONATE
//
bot.action(
/vote_comment_(.+)/,
async (ctx) => {

try {


const district =
  ctx.match[1];

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

const donateUrl =
  `https://send.monobank.ua/jar/3NysFcAawr`;

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
