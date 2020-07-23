const cron = require("cron");
const client = require("../utils/client.js");
const database = require("../utils/database.js");
const collections = require("../utils/collections.js");
const logger = require("../utils/logger.js");
const messages = require("../messages.json");
const misc = require("../utils/misc.js");
const soundPlayer = require("../utils/soundplayer.js");
const helpGenerator =
  process.env.OUTPUT !== "" ? require("../utils/help.js") : null;
const twitter =
  process.env.TWITTER === "true" ? require("../utils/twitter.js") : null;
const first = process.env.PMTWO === "true" ? process.env.NODE_APP_INSTANCE === "0" : true;
let run = false;

// run when ready
module.exports = async () => {
  // connect to lavalink
  if (!soundPlayer.status && !soundPlayer.connected) await soundPlayer.connect();

  // make sure settings/tags exist
  for (const [id] of client.guilds) {
    const guildDB = await database.query("SELECT * FROM guilds WHERE guild_id = $1", [id]);
    if (guildDB.rows.length === 0) {
      logger.log(`Registering guild database entry for guild ${id}...`);
      await database.query("INSERT INTO guilds (guild_id, tags, prefix, warns, disabled) VALUES ($1, $2, $3, $4, $5)", [id, misc.tagDefaults, "&", {}, []]);
    }
  }

  if (!run && first) {
    const job = new cron.CronJob("0 0 * * 0", async () => {
      logger.log("Deleting stale guild entries in database...");
      const guildDB = await database.query("SELECT * FROM guilds");
      for (const { guild_id } of guildDB.rows) {
        if (!client.guilds.get(guild_id)) {
          await database.query("DELETE FROM guilds WHERE guild_id = $1", [guild_id]);
          logger.log(`Deleted entry for guild ID ${guild_id}.`);
        }
      }
      logger.log("Finished deleting stale entries.");
    });
    job.start();
  }

  let counts;
  try {
    counts = await database.query("SELECT * FROM counts");
  } catch {
    counts = { rows: [] };
  }
  if (!counts.rows[0]) {
    for (const command of collections.commands.keys()) {
      await database.query("INSERT INTO counts (command, count) VALUES ($1, $2)", [command, 0]);
    }
  } else {
    for (const command of collections.commands.keys()) {
      const count = await database.query("SELECT * FROM counts WHERE command = $1", [command]);
      if (!count.rows[0]) {
        await database.query("INSERT INTO counts (command, count) VALUES ($1, $2)", [command, 0]);
      }
    }
  }

  // generate docs
  if (helpGenerator && first) await helpGenerator(process.env.OUTPUT);

  // set activity (a.k.a. the gamer code)
  (async function activityChanger() {
    client.editStatus("dnd", {
      name: `${misc.random(messages)} | @esmBot help`,
    });
    setTimeout(activityChanger, 900000);
  })();

  // tweet stuff
  if (twitter !== null && twitter.active === false && first) {
    const blocks = await twitter.client.blocks.ids();
    const tweet = async () => {
      const tweetContent = await misc.getTweet(twitter.tweets);
      try {
        const info = await twitter.client.statuses.update(tweetContent);
        logger.log(`Tweet with id ${info.id_str} has been posted.`);
        // with status code ${info.resp.statusCode} ${info.resp.statusMessage}
      } catch (e) {
        const error = JSON.stringify(e);
        if (error.includes("Status is a duplicate.")) {
          logger.log("Duplicate tweet, will retry in 30 minutes");
        } else {
          logger.error(e);
        }
      }
    };
    tweet();
    setInterval(tweet, 1800000);
    twitter.active = true;
    try {
      const stream = twitter.client.statuses.filter(`@${process.env.HANDLE}`);
      stream.on("data", async (tweet) => {
        if (
          tweet.user.screen_name !== "esmBot_" &&
        !blocks.ids.includes(tweet.user.id_str)
        ) {
          let tweetContent;
          if (new RegExp(["@this_vid", "@DownloaderBot", "GetVideoBot", "@thisvid_"].join("|")).test(tweet.text)) {
            tweetContent = await misc.getTweet(twitter.tweets, true, true);
          } else {
            tweetContent = await misc.getTweet(twitter.tweets, true).replace(/{{user}}/gm, `@${tweet.user.screen_name}`);
          }
          const payload = {
            status: `@${tweet.user.screen_name} ${tweetContent}`,
            in_reply_to_status_id: tweet.id_str,
          };
          const info = await twitter.client.statuses.update(payload);
          logger.log(`Reply with id ${info.id_str} has been posted.`);
        // with status code ${info.resp.statusCode} ${info.resp.statusMessage}
        }
      });
    } catch (e) {
      logger.error(`The Twitter streaming API ran into an error: ${e}`);
    }
  }

  if (process.env.PMTWO === "true") process.send("ready");
  logger.log(`Successfully started ${client.user.username}#${client.user.discriminator} with ${client.users.size} users in ${client.guilds.size} servers.`);
  run = true;
};
