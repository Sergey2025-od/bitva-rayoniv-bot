const pool =
require("../database/db");

async function updateLeaderboard(
bot
) {

const pollResult =
await pool.query(`       SELECT *
      FROM polls
      WHERE is_active = true
      ORDER BY id DESC
      LIMIT 1
    `);

const poll =
pollResult.rows[0];

if (!poll) {
return;
}

const totalsResult =
await pool.query(`       SELECT
        district,
        SUM(amount) as total
      FROM votes
      WHERE status = 'approved'
      GROUP BY district
    `);

let districtsResult;

if (
poll.tournament_districts
) {


districtsResult =
  await pool.query(
    `
    SELECT *
    FROM districts
    WHERE code = ANY($1)
    ORDER BY id
    `,
    [
      poll.tournament_districts
        .split(",")
    ]
  );


} else {


districtsResult =
  await pool.query(`
    SELECT *
    FROM districts
    WHERE active = true
    ORDER BY id
  `);


}

let leaderboard =
`🏆 ${poll.title}\n\n`;

if (
poll.tournament_stage
) {


leaderboard +=
  `🏁 ${poll.tournament_stage} фіналу\n\n`;


}

for (
const districtRow
of districtsResult.rows
) {


const totalRow =
  totalsResult.rows.find(
    (r) =>
      r.district ===
      districtRow.code
  );

const total =
  totalRow
    ? totalRow.total
    : 0;

leaderboard +=
  `${districtRow.emoji} ` +
  `${districtRow.name} — ${total}\n`;


}

const leftMinutes =
Math.max(
0,
Math.floor(
(
new Date(
poll.end_time
) -
new Date()
) / 60000
)
);

leaderboard +=
`\n\n⏱ Залишилось: ${leftMinutes} хв`;

leaderboard +=
`\n\n💸 1 грн = 1 голос`;

const replyMarkup = {
inline_keyboard: [
[
{
text:
"🗳 ПРОГОЛОСУВАТИ",


      url:
        "https://t.me/bitva_rayoniv_bot?start=vote"
    }
  ]
]


};

if (
poll.message_type ===
"photo"
) {


await bot.telegram.editMessageCaption(
  process.env.CHANNEL_ID,
  Number(
    poll.message_id
  ),
  null,
  leaderboard,
  {
    reply_markup:
      replyMarkup
  }
);


} else {


await bot.telegram.editMessageText(
  process.env.CHANNEL_ID,
  Number(
    poll.message_id
  ),
  null,
  leaderboard,
  {
    reply_markup:
      replyMarkup
  }
);


}
}

module.exports = {
updateLeaderboard,
};
