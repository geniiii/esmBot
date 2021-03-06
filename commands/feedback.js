const client = require("../utils/client.js");

exports.run = async (message, args) => {
  if (args.length !== 0) {
    const feedbackChannel = client.guilds.get("592399417676529688").channels.get("592429860769497098");
    feedbackChannel.createMessage({
      embed: {
        color: 16711680,
        timestamp: new Date(),
        thumbnail: {
          url: message.author.avatarURL
        },
        author: {
          name: "esmBot Feedback",
          icon_url: client.user.avatarURL
        },
        fields: [{
          name: "👥 Author:",
          value: `${message.author.username}#${message.author.discriminator}`
        }, {
          name: "👪 Server:",
          value: message.channel.guild.name
        }, {
          name: "💬 Message:",
          value: args.join(" ")
        }]
      }
    });
    return `${message.author.mention}, your feedback has been sent!`;
  } else {
    return `${message.author.mention}, you need to provide some feedback to send!`;
  }
};

exports.aliases = ["request", "report", "complain", "compliment"];
exports.category = 1;
exports.help = "Leaves some feedback for the bot owner";
exports.params = "[message]";