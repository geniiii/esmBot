const magick = require("../build/Release/image.node");
const { promisify } = require("util");

exports.run = async (message) => {
  message.channel.sendTyping();
  const image = await require("../utils/imagedetect.js")(message);
  if (image === undefined) return `${message.author.mention}, you need to provide a GIF to reverse!`;
  if (image.type !== "gif") return `${message.author.mention}, that isn't a GIF!`;
  const buffer = await promisify(magick.reverse)(image.path, false, image.delay ? (100 / image.delay.split("/")[0]) * image.delay.split("/")[1] : 0);
  return {
    file: buffer,
    name: "reverse.gif"
  };
};

exports.aliases = ["backwards"];
exports.category = 5;
exports.help = "Reverses a GIF";