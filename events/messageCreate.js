const fs = require("fs");
const { promisify } = require("util");
const client = require("../utils/client.js");
const database = require("../utils/database.js");
const logger = require("../utils/logger.js");
const collections = require("../utils/collections.js");

// run when someone sends a message
module.exports = async (message) => {
  // ignore dms and other bots
  if (message.author.bot) return;
  if (!message.channel.guild) return;

  // don't run command if bot can't send messages
  if (!message.channel.guild.members.get(client.user.id).permission.has("sendMessages") || !message.channel.permissionsOf(client.user.id).has("sendMessages")) return;

  // prefix can be a mention or a set of special characters
  const guildDB = await database.guilds.findOne({ id: message.channel.guild.id }).lean().exec();
  const prefixMention = new RegExp(`^<@!?${client.user.id}> `);
  const prefix = prefixMention.test(message.content) ? message.content.match(prefixMention)[0] : guildDB.prefix;

  // ignore other stuff
  if (message.content.startsWith(prefix) === false) return;

  // separate commands and args
  const content = message.content.substring(prefix.length).trim();
  const args = content.split(/ +/g);
  const command = args.shift().toLowerCase();

  // don't run if message is in a disabled channel
  if (guildDB.disabledChannels && guildDB.disabledChannels.includes(message.channel.id) && command != "channel") return;

  // check if command exists
  const cmd = collections.commands.get(command) || collections.commands.get(collections.aliases.get(command));
  if (!cmd) return;

  // actually run the command
  logger.log("info", `${message.author.username} (${message.author.id}) ran command ${command}`);
  try {
    const global = (await database.global.findOne({}).exec());
    const count = global.cmdCounts.get(collections.aliases.has(command) ? collections.aliases.get(command) : command);
    global.cmdCounts.set(collections.aliases.has(command) ? collections.aliases.get(command) : command, parseInt(count) + 1);
    await global.save();
    const result = await cmd(message, args, content.replace(command, "").trim()); // we also provide the message content as a parameter for cases where we need more accuracy
    if (typeof result === "string" || (typeof result === "object" && result.embed)) {
      await client.createMessage(message.channel.id, result);
    } else if (typeof result === "object" && result.file) {
      if (result.file.length > 8388119 && process.env.TEMPDIR !== "") {
        const filename = `${Math.random().toString(36).substring(2, 15)}.${result.name.split(".")[1]}`;
        await promisify(fs.writeFile)(`${process.env.TEMPDIR}/${filename}`, result.file);
        await client.createMessage(message.channel.id, {
          embed: {
            color: 16711680,
            title: "What's this?",
            url: "https://projectlounge.pw/esmBot#faq-large",
            image: {
              url: `https://projectlounge.pw/tmp/${filename}`
            }
          }
        });
      } else {
        await client.createMessage(message.channel.id, result.text ? result.text : "", result);
      }
    }
  } catch (error) {
    if (error.toString().includes("Request entity too large")) {
      await client.createMessage(message.channel.id, `${message.author.mention}, the resulting file was too large to upload. Try again with a smaller image if possible.`);
    } else if (error.toString().includes("Timed out")) {
      await client.createMessage(message.channel.id, `${message.author.mention}, the request timed out before I could download that image. Try uploading your image somewhere else.`);
    } else {
      logger.error(error.toString());
      await client.createMessage(message.channel.id, "Uh oh! I ran into an error while running this command. Please report the content of the attached file here or on the esmBot Support server: <https://github.com/TheEssem/esmBot/issues>", [{
        file: Buffer.from(`Message: ${error}\n\nStack Trace: ${error.stack}`),
        name: "error.txt"
      }]);
    }
  }
};
