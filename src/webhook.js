const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./database/db");

const { updateLeaderboard } = require("./polls/leaderboard");

const app = express();

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).send("Bot is alive");
});

app.use(bodyParser.json());

// ─────────────────────────────────────────────
// Mono Webhook
// ─────────────────────────────────────────────
app.post("/mono-webhook", async (req, res) => {
  try {
    console.log("🔥 MONO WEBHOOK:");
    console.log(JSON.stringify(req.body, null, 2));

    const statementItem = req.body?.data?.statementItem;

    if (!statementItem) {
      return res.sendStatus(200);
    }

    // Тільки вхідні платежі (amount > 0)
    if (statementItem.amount <= 0) {
      return res.sendStatus(200);
    }

    const comment = (statementItem.comment || "").trim();
    const amount = Math.floor(statementItem.amount / 100);

    console.log(`💬 Коментар: "${comment}", сума: ${amount} грн`);

    // ══════════════════════════════════════════
    // КРОК 1: Шукаємо pending_payment по коду з коментаря
    // ══════════════════════════════════════════
    const pendingResult = await pool.query(`
      SELECT *
      FROM pending_payments
      WHERE code = $1
        AND expires_at > NOW()
      LIMIT 1
    `, [comment]);

    const pending = pendingResult.rows[0];

    if (pending) {
      console.log("✅ Знайдено pending_payment:", pending);

      // Перевіряємо активне голосування
      const pollResult = await pool.query(`
        SELECT * FROM polls
        WHERE id = $1
        LIMIT 1
      `, [pending.poll_id]);

      const poll = pollResult.rows[0];

      if (!poll) {
        console.log("❌ Poll не знайдено для pending_payment");
        await pool.query(`DELETE FROM pending_payments WHERE code = $1`, [comment]);
        return res.sendStatus(200);
      }

      if (pending.option_id) {
        // ── КАСТОМНИЙ ВАРІАНТ ──
        await pool.query(`
          UPDATE poll_options
          SET votes = votes + $1
          WHERE id = $2
        `, [amount, pending.option_id]);

        console.log(`✅ CUSTOM AUTO VOTE: option ${pending.option_id} +${amount}`);

      } else {
        // ── РАЙОН ──
        await pool.query(`
          INSERT INTO votes (user_id, username, district, amount, status, poll_id)
          VALUES ($1, $2, $3, $4, 'approved', $5)
        `, [
          pending.user_id,
          "mono_auto",
          pending.district,
          amount,
          pending.poll_id,
        ]);

        console.log(`✅ DISTRICT AUTO VOTE: ${pending.district} +${amount} (user ${pending.user_id})`);
      }

      // Видаляємо використаний код
      await pool.query(`DELETE FROM pending_payments WHERE code = $1`, [comment]);

      // Оновлюємо пост у каналі
      try {
        const { Telegraf } = require("telegraf");
        const bot = new Telegraf(process.env.BOT_TOKEN);
        await updateLeaderboard(bot);
      } catch (e) {
        console.log("⚠️ Leaderboard update error:", e.message);
      }

      return res.sendStatus(200);
    }

    // ══════════════════════════════════════════
    // КРОК 2: Коду не знайдено — fallback по ключовим словам (район)
    // ══════════════════════════════════════════
    console.log("⚠️ Pending не знайдено, пробуємо ключові слова...");

    const text = comment.toLowerCase();
    let districtCode = matchDistrictByKeyword(text);

    if (districtCode) {
      console.log(`🔍 Знайдено район по ключовому слову: ${districtCode}`);

      const pollResult = await pool.query(`
        SELECT * FROM polls
        WHERE is_active = true
        ORDER BY id DESC
        LIMIT 1
      `);

      const poll = pollResult.rows[0];

      if (poll && poll.poll_type !== "custom") {
        await pool.query(`
          INSERT INTO votes (user_id, username, district, amount, status, poll_id)
          VALUES ($1, $2, $3, $4, 'approved', $5)
        `, ["mono_keyword", "mono_keyword", districtCode, amount, poll.id]);

        console.log(`✅ KEYWORD VOTE: ${districtCode} +${amount}`);

        try {
          const { Telegraf } = require("telegraf");
          const bot = new Telegraf(process.env.BOT_TOKEN);
          await updateLeaderboard(bot);
        } catch (e) {
          console.log("⚠️ Leaderboard update error:", e.message);
        }
      }

      return res.sendStatus(200);
    }

    // ══════════════════════════════════════════
    // КРОК 3: Нічого не розпізнано — логуємо
    // ══════════════════════════════════════════
    console.log(`❌ Платіж ${amount} грн не розпізнано. Коментар: "${comment}"`);
    // Нічого не робимо — адмін може додати вручну через /admin

    return res.sendStatus(200);

  } catch (error) {
    console.log("❌ WEBHOOK ERROR:", error);
    res.sendStatus(500);
  }
});

// ─────────────────────────────────────────────
// Розпізнавання району по ключовим словам
// ─────────────────────────────────────────────
function matchDistrictByKeyword(text) {
  if (text.includes("черем") || text.includes("черьому")) return "cheremushki";
  if (text.includes("молд"))                                return "moldovanka";
  if (text.includes("арк"))                                  return "arkadia";
  if (
    text.includes("таір") ||
    text.includes("таир") ||
    text.includes("лиман") ||
    text.includes("сав")
  )                                                          return "tairchik";
  if (text.includes("центр"))                               return "center";
  if (text.includes("слобод"))                              return "slobodka";
  if (text.includes("перес"))                               return "peresyp";
  if (text.includes("поскот"))                              return "poskot";
  if (
    text.includes("аванг") ||
    text.includes("7 км") ||
    text.includes("ленпас")
  )                                                          return "avangard";
  if (
    text.includes("крива") ||
    text.includes("усат") ||
    text.includes("неруб")
  )                                                          return "krivaya";
  if (
    text.includes("холод") ||
    text.includes("дачн")
  )                                                          return "holodka";

  return null;
}

module.exports = app;
