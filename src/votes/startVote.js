const { Markup } = require("telegraf");
const pool = require("../database/db");

// ─────────────────────────────────────────────
// Генерує короткий унікальний код для платежу
// Формат: abc_USERID_RANDOMHEX  (макс ~30 символів)
// ─────────────────────────────────────────────
function generateCode(prefix, userId) {
  const rand = Math.random().toString(16).slice(2, 8); // 6 символів hex
  return `${prefix}_${userId}_${rand}`;
}

// ─────────────────────────────────────────────
// Спільна логіка показу кнопок вибору
// ─────────────────────────────────────────────
async function showVoteMenu(ctx, pool) {
  const pollResult = await pool.query(`
    SELECT * FROM polls
    WHERE is_active = true
    ORDER BY id DESC
    LIMIT 1
  `);

  const poll = pollResult.rows[0];

  if (!poll) {
    return ctx.reply("❌ Зараз немає активного голосування.");
  }

  // ── CUSTOM POLL ──
  if (poll.poll_type === "custom") {
    const result = await pool.query(`
      SELECT * FROM poll_options
      WHERE poll_id = $1
      ORDER BY id
    `, [poll.id]);

    const buttons = result.rows.map((option) => [
      Markup.button.callback(
        `◀️ ${option.title} ▶️`,
        poll.vote_type === "donate"
          ? `donate_option_${option.id}`
          : `option_${option.id}`
      ),
    ]);

    return ctx.reply(
      "🏆 Оберіть варіант:",
      Markup.inlineKeyboard(buttons)
    );
  }

  // ── DISTRICT POLL ──
  let result;

  if (poll.tournament_districts) {
    result = await pool.query(`
      SELECT * FROM districts
      WHERE code = ANY($1)
      ORDER BY id
    `, [poll.tournament_districts.split(",")]);
  } else {
    result = await pool.query(`
      SELECT * FROM districts
      WHERE active = true
      ORDER BY id
    `);
  }

  const buttons = result.rows.map((district) => [
    Markup.button.callback(
      `${district.emoji} ${district.name}`,
      `vote_${district.code}`
    ),
  ]);

  return ctx.reply(
    "🏆 Оберіть район для голосування:",
    Markup.inlineKeyboard(buttons)
  );
}

// ─────────────────────────────────────────────
// Зберігає pending_payment і повертає код
// ─────────────────────────────────────────────
async function createPendingPayment({ userId, district, optionId, pollId, prefix }) {
  const code = generateCode(prefix, userId);

  await pool.query(`
    INSERT INTO pending_payments (
      code, user_id, district, option_id, poll_id, expires_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '2 hours')
    ON CONFLICT (code) DO NOTHING
  `, [code, userId, district || null, optionId || null, pollId]);

  return code;
}

// ─────────────────────────────────────────────
// Повідомлення з кодом для коментаря
// ─────────────────────────────────────────────
function buildPaymentMessage(label, code) {
  return (
    `💳 Для голосування задонатьте будь-яку суму\n\n` +
    `🏆 ${label}\n\n` +
    `⚠️ ОБОВ'ЯЗКОВО вкажіть у коментарі до платежу:\n\n` +
    `<code>${code}</code>\n\n` +
    `👆 Натисніть на код щоб скопіювати\n\n` +
    `💸 1 грн = 1 голос\n` +
    `⏱ Код дійсний 2 години`
  );
}

// ═════════════════════════════════════════════
module.exports = (bot, userStates) => {
  // ─────────────────────────────────────────────
  // /start — головний обробник
  // ─────────────────────────────────────────────
  bot.start(async (ctx) => {
    const ADMIN_ID = process.env.ADMIN_ID;

    if (ctx.from.id.toString() === ADMIN_ID) {
      return ctx.reply("👑 Ви увійшли як адміністратор\n\n/admin");
    }

    await showVoteMenu(ctx, pool);
  });

  // ─────────────────────────────────────────────
  // /start vote — deep link з каналу
  // ─────────────────────────────────────────────
  bot.command("start", async (ctx, next) => {
    if (ctx.message.text !== "/start vote") return next();
    await showVoteMenu(ctx, pool);
  });

  // ─────────────────────────────────────────────
  // Вибір РАЙОНУ → генеруємо код і показуємо інструкцію
  // ─────────────────────────────────────────────
  bot.action(/^vote_([^_]+)$/, async (ctx) => {
    try {
      const districtCode = ctx.match[1];

      // Перевіряємо активне голосування
      const pollResult = await pool.query(`
        SELECT * FROM polls
        WHERE is_active = true
        ORDER BY id DESC
        LIMIT 1
      `);

      const poll = pollResult.rows[0];

      if (!poll) {
        return ctx.reply("❌ Голосування завершено.");
      }

      // Дані про район
      const districtResult = await pool.query(`
        SELECT * FROM districts
        WHERE code = $1
        LIMIT 1
      `, [districtCode]);

      const district = districtResult.rows[0];

      if (!district) {
        return ctx.reply("❌ Район не знайдено.");
      }

      // ── Безкоштовне голосування (без доната) ──
      if (poll.vote_type === "free") {
        // Перевіряємо чи вже голосував
        const voted = await pool.query(`
          SELECT id FROM votes
          WHERE user_id = $1 AND poll_id = $2
          LIMIT 1
        `, [ctx.from.id, poll.id]);

        if (voted.rows.length) {
          return ctx.answerCbQuery("❌ Ви вже голосували");
        }

        await pool.query(`
          INSERT INTO votes (user_id, username, district, amount, status, poll_id)
          VALUES ($1, $2, $3, 1, 'approved', $4)
        `, [ctx.from.id, ctx.from.username || "", districtCode, poll.id]);

        await ctx.answerCbQuery("✅ Ваш голос зараховано");
        return ctx.reply(`✅ Ви проголосували за:\n\n${district.emoji} ${district.name}`);
      }

      // ── Донат-голосування → генеруємо код ──
      const code = await createPendingPayment({
        userId: ctx.from.id,
        district: districtCode,
        optionId: null,
        pollId: poll.id,
        prefix: districtCode.slice(0, 5), // перші 5 символів коду району
      });

      const label = `Район: ${district.emoji} ${district.name}`;

      await ctx.reply(
        buildPaymentMessage(label, code),
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "💳 ВІДКРИТИ MONO",
                  url: "https://send.monobank.ua/jar/3NysFcAawr",
                },
              ],
              [
                {
                  text: "📸 Не вийшло? Надіслати скрін",
                  callback_data: `screenshot_district_${districtCode}`,
                },
              ],
            ],
          },
        }
      );

    } catch (error) {
      console.log(error);
    }
  });

  // ─────────────────────────────────────────────
  // Вибір КАСТОМНОГО ВАРІАНТУ (безкоштовне)
  // ─────────────────────────────────────────────
  bot.action(/^option_(\d+)$/, async (ctx) => {
    try {
      const optionId = Number(ctx.match[1]);

      const pollResult = await pool.query(`
        SELECT * FROM polls
        WHERE is_active = true
        ORDER BY id DESC
        LIMIT 1
      `);

      const poll = pollResult.rows[0];

      if (!poll) return ctx.answerCbQuery("Голосування завершено");

      // Перевірка чи вже голосував
      const voted = await pool.query(`
        SELECT id FROM votes
        WHERE user_id = $1 AND poll_id = $2
        LIMIT 1
      `, [ctx.from.id, poll.id]);

      if (voted.rows.length) {
        return ctx.answerCbQuery("❌ Ви вже голосували");
      }

      const optionResult = await pool.query(`
        SELECT * FROM poll_options
        WHERE id = $1
        LIMIT 1
      `, [optionId]);

      const option = optionResult.rows[0];
      if (!option) return ctx.answerCbQuery("Варіант не знайдено");

      // Зберігаємо голос
      await pool.query(`
        INSERT INTO votes (user_id, username, district, amount, status, option_code, poll_id)
        VALUES ($1, $2, '', 1, 'approved', $3, $4)
      `, [ctx.from.id, ctx.from.username || "", option.code, poll.id]);

      await pool.query(`
        UPDATE poll_options SET votes = votes + 1 WHERE id = $1
      `, [optionId]);

      await ctx.answerCbQuery("✅ Ваш голос зараховано");
      await ctx.reply(`✅ Ви проголосували за:\n\n🔹 ${option.title}`);

    } catch (error) {
      console.log(error);
      await ctx.answerCbQuery("Помилка голосування");
    }
  });

  // ─────────────────────────────────────────────
  // Вибір КАСТОМНОГО ВАРІАНТУ (донатне) → генеруємо код
  // ─────────────────────────────────────────────
  bot.action(/^donate_option_(\d+)$/, async (ctx) => {
    try {
      const optionId = Number(ctx.match[1]);

      const pollResult = await pool.query(`
        SELECT * FROM polls
        WHERE is_active = true
        ORDER BY id DESC
        LIMIT 1
      `);

      const poll = pollResult.rows[0];
      if (!poll) return ctx.reply("❌ Голосування завершено.");

      const optionResult = await pool.query(`
        SELECT * FROM poll_options
        WHERE id = $1
        LIMIT 1
      `, [optionId]);

      const option = optionResult.rows[0];
      if (!option) return ctx.reply("❌ Варіант не знайдено.");

      // Генеруємо код
      const code = await createPendingPayment({
        userId: ctx.from.id,
        district: null,
        optionId: option.id,
        pollId: poll.id,
        prefix: `opt${option.id}`,
      });

      const label = `Варіант: ${option.title}`;

      await ctx.reply(
        buildPaymentMessage(label, code),
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "💳 ВІДКРИТИ MONO",
                  url: "https://send.monobank.ua/jar/3NysFcAawr",
                },
              ],
              [
                {
                  text: "📸 Не вийшло? Надіслати скрін",
                  callback_data: `screenshot_option_${option.id}`,
                },
              ],
            ],
          },
        }
      );

    } catch (error) {
      console.log(error);
    }
  });

  // ─────────────────────────────────────────────
  // Кнопка "Надіслати скрін" для РАЙОНУ
  // ─────────────────────────────────────────────
  bot.action(/^screenshot_district_(.+)$/, async (ctx) => {
    const districtCode = ctx.match[1];

    const districtResult = await pool.query(`
      SELECT * FROM districts WHERE code = $1 LIMIT 1
    `, [districtCode]);

    const district = districtResult.rows[0];
    if (!district) return ctx.reply("❌ Район не знайдено.");

    userStates[ctx.from.id] = {
      district: district.code,
      districtName: district.name,
      districtEmoji: district.emoji,
    };

    await ctx.reply(
      `📸 Надішліть скрін доната\n\n` +
      `🏆 Район: ${district.emoji} ${district.name}\n\n` +
      `Адмін перевірить і зарахує голоси вручну.`
    );
  });

  // ─────────────────────────────────────────────
  // Кнопка "Надіслати скрін" для КАСТОМНОГО ВАРІАНТУ
  // ─────────────────────────────────────────────
  bot.action(/^screenshot_option_(\d+)$/, async (ctx) => {
    const optionId = Number(ctx.match[1]);

    const optionResult = await pool.query(`
      SELECT * FROM poll_options WHERE id = $1 LIMIT 1
    `, [optionId]);

    const option = optionResult.rows[0];
    if (!option) return ctx.reply("❌ Варіант не знайдено.");

    userStates[ctx.from.id] = {
      customOption: option.id,
      customTitle: option.title,
    };

    await ctx.reply(
      `📸 Надішліть скрін доната\n\n` +
      `🏆 Варіант: ${option.title}\n\n` +
      `Адмін перевірить і зарахує голоси вручну.`
    );
  });
};
