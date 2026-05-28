const {
  updateLeaderboard,
} = require(
  "./leaderboard"
);

module.exports = (
  bot
) => {

  //
  // LIVE TIMER
  //
  setInterval(
    async () => {

      try {

        await updateLeaderboard(
          bot
        );

      } catch (error) {

        console.log(error);
      }

    },
    60000
  );

};