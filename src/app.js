require("dotenv").config();

const { Telegraf } =
  require("telegraf");

const app =
  require("./webhook");

const {
  checkMonobank,
} = require("./mono");

//
// BOT
//
const bot =
  new Telegraf(
    process.env.BOT_TOKEN
  );

//
// STATES
//
const userStates =
  {};

//
// ADMIN
//
require("./admin/panel")(
  bot,
  userStates
);

require("./admin/currentPoll")(
  bot,
  userStates
);

require("./admin/tournament")(
  bot,
  userStates
);

//
// POLLS
//
require("./polls/create")(
  bot,
  userStates
);

require("./polls/finish")(
  bot,
  userStates
);

require("./polls/timer")(
  bot,
  userStates
);

require("./polls/liveCountdown")(
  bot,
  userStates
);

//
// VOTES
//
require("./votes/manualVotes")(
  bot,
  userStates
);

require("./votes/screenshots")(
  bot,
  userStates
);

require("./votes/commentVotes")(
  bot,
  userStates
);

require("./votes/startVote")(
  bot,
  userStates
);

//
// START BOT
//
bot.launch({
  dropPendingUpdates: true,
});

console.log(
  "🔥 Bot started"
);

//
// SERVER
//
const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  () => {

    console.log(
      "🚀 Webhook started"
    );
  }
);

//
// MONO CHECK
//
setInterval(
  () => {

    console.log(
      "🔄 CHECKING MONO"
    );

    checkMonobank(
      bot
    );

  },
  35000
);