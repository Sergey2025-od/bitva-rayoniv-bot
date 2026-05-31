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
               VALUES ($1, 'mono', $2, $3, 'approved', $4)`,
              [pending.user_id, pending.district, amount, pending.poll_id]
            );
            console.log(`✅ PENDING CODE vote: district ${pending.district} +${amount}`);
          }

          await pool.query(`DELETE FROM pending_payments WHERE code = $1`, [code]);
          await updateLeaderboard(bot);
          continue;
        }
      }

      //
      // CUSTOM POLL
      //
      const customPollResult = await pool.query(`
        SELECT * FROM polls WHERE is_active = true ORDER BY id DESC LIMIT 1
      `);
      const customPoll = customPollResult.rows[0];

      if (customPoll && customPoll.poll_type === "custom") {
        const optionsResult = await pool.query(
          `SELECT * FROM poll_options WHERE poll_id = $1`,
          [customPoll.id]
        );

        let matchedOption = null;
        for (const option of optionsResult.rows) {
          if (text.includes(option.title.toLowerCase())) {
            matchedOption = option;
            break;
          }
        }

        if (matchedOption) {
          const amount = Math.floor(tx.amount / 100);
          await pool.query(
            `UPDATE poll_options SET votes = votes + $1 WHERE id = $2`,
            [amount, matchedOption.id]
          );
          console.log(`✅ CUSTOM VOTE: ${matchedOption.title} +${amount}`);
          await updateLeaderboard(bot);
          continue;
        }
      }

      //
      // DISTRICT MATCH
      //
      let districtCode = null;

      if (text.includes("черем") || text.includes("черьому")) districtCode = "cheremushki";
      if (text.includes("молд")) districtCode = "moldovanka";
      if (text.includes("арк")) districtCode = "arkadia";
      if (text.includes("таір") || text.includes("таир") || text.includes("лиман") || text.includes("сав")) districtCode = "tairchik";
      if (text.includes("центр")) districtCode = "center";
      if (text.includes("слобод")) districtCode = "slobodka";
      if (text.includes("перес")) districtCode = "peresyp";
      if (text.includes("поскот")) districtCode = "poskot";
      if (text.includes("аванг") || text.includes("7 км") || text.includes("ленпас")) districtCode = "avangard";
      if (text.includes("крива") || text.includes("усат") || text.includes("неруб")) districtCode = "krivaya";
      if (text.includes("холод") || text.includes("дачн")) districtCode = "holodka";

      if (!districtCode) {
        console.log("❌ DISTRICT NOT FOUND");
        continue;
      }

      const amount = Math.floor(tx.amount / 100);
      console.log(`💸 ${districtCode}: ${amount}`);

      await pool.query(
        `INSERT INTO votes (user_id, username, district, amount, status)
         VALUES ($1, $2, $3, $4, 'approved')`,
        ["mono", "mono", districtCode, amount]
      );

      await updateLeaderboard(bot);
      console.log("✅ LEADERBOARD UPDATED");
    }

  } catch (error) {
    console.log("❌ MONO ERROR");
    console.log(error.response?.data || error.message);
  }
}

module.exports = {
  checkMonobank,
};
