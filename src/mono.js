const axios = require("axios");

const pool = require("./database/db");

let lastTransactionTime = Math.floor(Date.now() / 1000) - 300; // стартуємо з 5 хв назад, не з нуля

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

      // Пропускаємо якщо немає активного голосування
      const activePollCheck = await pool.query(
        `SELECT id FROM polls WHERE is_active = true LIMIT 1`
      );
      if (!activePollCheck.rows[0]) {
        console.log("⏭ No active poll, skipping transaction");
        continue;
      }

      console.log(
        "💬 TX TEXT:",
        text
      );

      //
      // PENDING PAYMENT CODE MATCH (пріоритет — шукаємо унікальний код у коментарі)
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
            // Custom poll option
            await pool.query(
              `UPDATE poll_options SET votes = votes + $1 WHERE id = $2`,
              [amount, pending.option_id]
            );
            console.log(`✅ PENDING CODE vote: option #${pending.option_id} +${amount}`);
          } else if (pending.district) {
            // District poll
            await pool.query(
              `INSERT INTO votes (user_id, username, district, amount, status, poll_id)
               VALUES ($1, 'mono', $2, $3, 'approved', $4)`,
              [pending.user_id, pending.district, amount, pending.poll_id]
            );
            console.log(`✅ PENDING CODE vote: district ${pending.district} +${amount}`);
          }

          // Видаляємо використаний код
          await pool.query(`DELETE FROM pending_payments WHERE code = $1`, [code]);

          // Оновлюємо лідерборд у каналі
          await updateChannelLeaderboard(bot, pending.poll_id);

          continue;
        }
      }

//
// CUSTOM POLL
//
const customPollResult =
  await pool.query(`
    SELECT *
    FROM polls
    WHERE is_active = true
    ORDER BY id DESC
    LIMIT 1
  `);

const customPoll =
  customPollResult.rows[0];

if (
  customPoll &&
  customPoll.poll_type === "custom"
) {

  const optionsResult =
    await pool.query(
      `
      SELECT *
      FROM poll_options
      WHERE poll_id = $1
      `,
      [customPoll.id]
    );

  let matchedOption =
    null;

  for (
    const option
    of optionsResult.rows
  ) {

    if (
      text.includes(
        option.title.toLowerCase()
      )
    ) {

      matchedOption =
        option;

      break;
    }
  }

  if (
    matchedOption
  ) {

    const amount =
      Math.floor(
        tx.amount / 100
      );

    await pool.query(
      `
      UPDATE poll_options
      SET votes = votes + $1
      WHERE id = $2
      `,
      [
        amount,
        matchedOption.id
      ]
    );

    console.log(
      `✅ CUSTOM VOTE: ${matchedOption.title} +${amount}`
    );

    continue;
  }
}
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

// ─────────────────────────────────────────────
// Оновлює лідерборд у каналі після голосу
// ─────────────────────────────────────────────
async function updateChannelLeaderboard(bot, pollId) {
  try {
    const pollResult = await pool.query(
      `SELECT * FROM polls WHERE id = $1 LIMIT 1`,
      [pollId]
    );
    const poll = pollResult.rows[0];
    if (!poll || !poll.message_id) return;

    let leaderboard = `🏆 ${poll.title}\n\n`;

    if (poll.poll_type === "custom") {
      const optionsResult = await pool.query(
        `SELECT * FROM poll_options WHERE poll_id = $1 ORDER BY votes DESC, id`,
        [poll.id]
      );
      optionsResult.rows.forEach((opt) => {
        leaderboard += `▫️ ${opt.title} — ${opt.votes}\n`;
      });
    } else {
      const totalsResult = await pool.query(`
        SELECT district, SUM(amount) as total
        FROM votes WHERE status = 'approved'
        GROUP BY district
      `);

      let districtsResult;
      if (poll.tournament_districts) {
        districtsResult = await pool.query(
          `SELECT * FROM districts WHERE code = ANY($1) ORDER BY id`,
          [poll.tournament_districts.split(",")]
        );
      } else {
        districtsResult = await pool.query(
          `SELECT * FROM districts WHERE active = true ORDER BY id`
        );
      }

      for (const district of districtsResult.rows) {
        const row = totalsResult.rows.find((r) => r.district === district.code);
        const total = row ? row.total : 0;
        leaderboard += `${district.emoji} ${district.name} — ${total}\n`;
      }
    }

    leaderboard += `\n💸 1 грн = 1 голос`;
    leaderboard += `\n\n👇 Голосуйте через бота`;
    leaderboard += `\nhttps://t.me/bitva_rayoniv_bot?start=vote`;

    if (poll.message_type === "photo") {
      await bot.telegram.editMessageCaption(
        process.env.CHANNEL_ID,
        Number(poll.message_id),
        null,
        leaderboard
      );
    } else {
      await bot.telegram.editMessageText(
        process.env.CHANNEL_ID,
        Number(poll.message_id),
        null,
        leaderboard
      );
    }

    console.log("✅ LEADERBOARD UPDATED (pending code)");
  } catch (err) {
    console.log("⚠️ updateChannelLeaderboard error:", err.message);
  }
}

module.exports = {
  checkMonobank,
};
