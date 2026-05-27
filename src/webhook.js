const express = require("express");
const bodyParser = require("body-parser");

const pool = require("./database/db");

const app = express();

app.use(bodyParser.json());

app.post("/mono-webhook", async (req, res) => {

  try {

    console.log("🔥 MONO WEBHOOK:");
    console.log(
  JSON.stringify(req.body, null, 2)
);

    const statementItem = req.body?.data?.statementItem;

    if (!statementItem) {
      return res.sendStatus(200);
    }

    //
    // COMMENT
    //
    const comment =
      statementItem.comment || "";

    //
    // AMOUNT
    //
    const amount =
      Math.floor(statementItem.amount / 100);

    //
    // DISTRICT
    //
    const districtCode =
      comment.toLowerCase().trim();

    //
    // FIND DISTRICT
    //
    const districtResult = await pool.query(
      `
      SELECT *
      FROM districts
      WHERE code = $1
      LIMIT 1
      `,
      [districtCode]
    );

    const district = districtResult.rows[0];

    if (!district) {
      console.log("❌ DISTRICT NOT FOUND");
      return res.sendStatus(200);
    }

    //
    // SAVE VOTE
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
      VALUES ($1, $2, $3, $4, 'approved')
      `,
      [
        "mono",
        "mono",
        district.code,
        amount,
      ]
    );

    //
    // ACTIVE POLL
    //
    const pollResult = await pool.query(`
      SELECT *
      FROM polls
      WHERE is_active = true
      ORDER BY id DESC
      LIMIT 1
    `);

    const poll = pollResult.rows[0];

    if (!poll) {
      return res.sendStatus(200);
    }

    //
    // TOTALS
    //
    const totalsResult = await pool.query(`
      SELECT
        district,
        SUM(amount) as total
      FROM votes
      WHERE status = 'approved'
      GROUP BY district
    `);

    //
    // DISTRICTS
    //
    const districtsResult = await pool.query(`
      SELECT *
      FROM districts
      WHERE active = true
      ORDER BY id
    `);

    //
    // BUILD TEXT
    //
    let text = `🏆 ${poll.title}\n\n`;

    for (const district of districtsResult.rows) {

      const totalRow = totalsResult.rows.find(
        (r) => r.district === district.code
      );

      const total = totalRow
        ? totalRow.total
        : 0;

      text +=
        `${district.emoji} ` +
        `${district.name} — ${total}\n`;
    }

    text += `\n💸 1 грн = 1 голос`;
    text += `\n\n👇 Голосуйте через бота`;
    text += `\n@bitva_rayoniv_bot`;

    //
    // UPDATE POST
    //
    const { Telegraf } = require("telegraf");

    const bot = new Telegraf(
      process.env.BOT_TOKEN
    );

    await bot.telegram.editMessageCaption(
      process.env.CHANNEL_ID,
      Number(poll.message_id),
      null,
      text
    );

    console.log("✅ POST UPDATED");

    res.sendStatus(200);

  } catch (error) {

    console.log(error);

    res.sendStatus(500);
  }
});

module.exports = app;
