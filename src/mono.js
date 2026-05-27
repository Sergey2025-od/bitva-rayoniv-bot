const axios = require("axios");

const pool = require("./database/db");

let lastTransactionTime = 0;

async function checkMonobank(bot) {

  try {

    //
    // GET TRANSACTIONS
    //
    const response = await axios.get(
      "https://api.monobank.ua/personal/statement/7zy1WAsCQCjbwfFQPaYF7FMruJ6mLMo/" +
      Math.floor(Date.now() / 1000 - 3600),
      {
        headers: {
          "X-Token":
            process.env.MONO_TOKEN,
        },
      }
    );

    const transactions =
      response.data;

    //
    // DEBUG
    //
    console.log(
  "🔥 MONO TRANSACTIONS:"
);

console.log(
  JSON.stringify(
    transactions.slice(0, 3),
    null,
    2
  )
);

    //
    // LOOP TRANSACTIONS
    //
    for (const tx of transactions) {

      //
      // SKIP OLD
      //
      if (
        tx.time <= lastTransactionTime
      ) {
        continue;
      }

      //
      // SAVE LAST TIME
      //
      if (
        tx.time > lastTransactionTime
      ) {
        lastTransactionTime =
          tx.time;
      }

      //
      // COMMENT / DESCRIPTION
      //
      const text =
        (
          tx.comment ||
          tx.description ||
          ""
        )
        .toLowerCase();

      console.log(
        "💬 TX TEXT:",
        text
      );

      //
      // DISTRICT MATCH
      //
      let districtCode = null;

      if (
        text.includes("черем") ||
        text.includes("черьому")
      ) {
        districtCode = "cheremushki";
      }

      if (
        text.includes("молд")
      ) {
        districtCode = "moldovanka";
      }

      if (
        text.includes("арк")
      ) {
        districtCode = "arkadia";
      }

      if (
        text.includes("таір") ||
        text.includes("таир") ||
        text.includes("лиман") ||
        text.includes("сав")
      ) {
        districtCode = "tairchik";
      }

      if (
        text.includes("центр")
      ) {
        districtCode = "center";
      }

      if (
        text.includes("слобод")
      ) {
        districtCode = "slobodka";
      }

      if (
        text.includes("перес")
      ) {
        districtCode = "peresyp";
      }

      if (
        text.includes("поскот")
      ) {
        districtCode = "poskot";
      }

      if (
        text.includes("аванг") ||
        text.includes("7 км") ||
        text.includes("ленпас")
      ) {
        districtCode = "avangard";
      }

      if (
        text.includes("крива") ||
        text.includes("усат") ||
        text.includes("неруб")
      ) {
        districtCode = "krivaya";
      }

      if (
        text.includes("холод") ||
        text.includes("дачн")
      ) {
        districtCode = "holodka";
      }

      //
      // NO DISTRICT
      //
      if (!districtCode) {

        console.log(
          "❌ DISTRICT NOT FOUND"
        );

        continue;
      }

      //
      // AMOUNT
      //
      const amount =
        Math.floor(tx.amount / 100);

      console.log(
        `💸 ${districtCode}: ${amount}`
      );

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
          districtCode,
          amount,
        ]
      );

      //
      // GET ACTIVE POLL
      //
      const pollResult =
        await pool.query(`
          SELECT *
          FROM polls
          WHERE is_active = true
          ORDER BY id DESC
          LIMIT 1
        `);

      const poll =
        pollResult.rows[0];

      if (!poll) {

        console.log(
          "❌ NO ACTIVE POLL"
        );

        continue;
      }

      //
      // GET TOTALS
      //
      const totalsResult =
        await pool.query(`
          SELECT
            district,
            SUM(amount) as total
          FROM votes
          WHERE status = 'approved'
          GROUP BY district
        `);

      //
      // GET DISTRICTS
      //
      const districtsResult =
        await pool.query(`
          SELECT *
          FROM districts
          WHERE active = true
          ORDER BY id
        `);

      //
      // BUILD LEADERBOARD
      //
      let leaderboard =
        `🏆 ${poll.title}\n\n`;

      for (
        const district
        of districtsResult.rows
      ) {

        const totalRow =
          totalsResult.rows.find(
            (r) =>
              r.district ===
              district.code
          );

        const total =
          totalRow
            ? totalRow.total
            : 0;

        leaderboard +=
          `${district.emoji} ` +
          `${district.name} — ${total}\n`;
      }

      leaderboard +=
        `\n💸 1 грн = 1 голос`;

      leaderboard +=
        `\n\n👇 Голосуйте через бота`;

      leaderboard +=
        `\nhttps://t.me/bitva_rayoniv_bot?start=vote`;

      //
      // UPDATE POST
      //
      await bot.telegram.editMessageText(
        process.env.CHANNEL_ID,
        Number(poll.message_id),
        null,
        leaderboard
      );

      console.log(
        "✅ LEADERBOARD UPDATED"
      );
    }

  } catch (error) {

    console.log(
      "❌ MONO ERROR"
    );

    console.log(
      error.response?.data ||
      error.message
    );
  }
}

module.exports = {
  checkMonobank,
};
