const pool =
require("../database/db");

const {
updateLeaderboard,
} = require(
"../polls/leaderboard"
);

const { Markup } =
require("telegraf");

module.exports = (
bot,
userStates
) => {

//
// ADMIN ADD VOTES
//
bot.action(
"admin_add_votes",
async (ctx) => {

try {


const districtsResult =
  await pool.query(`
    SELECT *
    FROM districts
    WHERE active = true
    ORDER BY id
  `);

const buttons =
  districtsResult.rows.map(
    (district) => [

      Markup.button.callback(
        `${district.emoji} ${district.name}`,
        `manual_vote_${district.code}`
      ),

    ]
  );

await ctx.reply(
  "🏆 Оберіть район",

  Markup.inlineKeyboard(
    buttons
  )
);


} catch (error) {


console.log(error);


}
}

);

//
// SELECT DISTRICT
//
bot.action(
/manual_vote_(.+)/,
async (ctx) => {

try {


const district =
  ctx.match[1];

userStates[
  ctx.from.id
] = {
  addingVotes: true,
  district,
};

await ctx.reply(
  "💸 Введіть кількість голосів"
);


} catch (error) {


console.log(error);


}
}

);

//
// SELECT CUSTOM OPTION
//
bot.action(
/manual_option_(.+)/,
async (ctx) => {

try {


const optionId =
  ctx.match[1];

userStates[
  ctx.from.id
] = {
  addingVotes: true,
  customOption: optionId,
};

await ctx.reply(
  "💸 Введіть кількість голосів"
);


} catch (error) {


console.log(error);


}
}

);

//
// SAVE VOTES
//
bot.hears(
/^\d+$/,
async (ctx, next) => {

try {


const state =
  userStates[
    ctx.from.id
  ];

if (
  !state?.addingVotes
) {
  return next();
}

const amount =
  Number(
    ctx.message.text
  );

if (!amount) {

  return ctx.reply(
    "❌ Введіть число"
  );
}

//
// CUSTOM OPTION
//
if (
  state.customOption
) {

  await pool.query(
    `
    UPDATE poll_options
    SET votes = votes + $1
    WHERE id = $2
    `,
    [
      amount,
      state.customOption
    ]
  );

  delete userStates[
    ctx.from.id
  ];

  return ctx.reply(
    "✅ Голоси додано до варіанту"
  );
}

//
// DISTRICT
//
await pool.query(
  `
  INSERT INTO votes (
    user_id,
    username,
    district,
    amount,
    status
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    'approved'
  )
  `,
  [
    "admin",
    "admin",
    state.district,
    amount,
  ]
);

await updateLeaderboard(
  bot
);

delete userStates[
  ctx.from.id
];

await ctx.reply(
  "✅ Голоси додано"
);


} catch (error) {


console.log(error);


}
}

);

};
