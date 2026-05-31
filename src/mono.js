const axios = require("axios");

const pool = require("./database/db");
const { updateLeaderboard } = require("./polls/leaderboard");

let lastTransactionTime = Math.floor(Date.now() / 1000) - 300;

async function checkMonobank(bot) {

  try {

    const response = await axios.get(
      "https://api.monobank.ua/personal/statement/7zy1WAsCQCjbwfFQPaYF7FMruJ6mLMo/" +
      Math.floor(Date.now() / 1000 - 3600),
      {
        headers: {
          "X-Token": process.env.MONO_TOKEN,
        },
      }
    );

    const transactions = response.data;

    for (const tx of transactions) {

      if (tx.time <= lastTransactionTime) {
        continue;
      }

      if (tx.time > lastTransactionTime) {
        lastTransactionTime = tx.time;
      }

      const text = (tx.comment || tx.description || "").toLowerCase();

      const activePollCheck = await pool.query(
        `SELECT id FROM polls WHERE is_active = true LIMIT 1`
      );
      if (!activePollCheck.rows[0]) {
        continue;
      }

      //
      // PENDING PAYMENT CODE MATCH
      //
      const rawComment = (tx.comment || tx.description || "").trim();
      const codeMatch = rawComment.match(/\b([a-z0-9]{1,10}_\d+_[a-f0-9]{6})\b/i);

      if (codeMatch) {
        const code = codeMatch[1].toLowerCase();
        const pendingResult = await pool.query(
          `SELECT * FROM pending_payments WHERE code = $1 AND expires_at > NOW() LIMIT 1`,
          [code]
        );
        const pending = pendingResult.rows[0];

        if (pending) {
          const amount = Math.floor(tx.amount / 100);

          if (pending.option_id) {
            await pool.query(
              `UPDATE poll_options SET votes = votes + $1 WHERE id = $2`,
              [amount, pending.option_id]
            );
            console.log(`✅ PENDING CODE vote: option #${pending.option_id} +${amount}`);
          } else if (pending.district) {
            await pool.query(
              `INSERT INTO votes (user_id, username, district, amount, status, poll_id)
