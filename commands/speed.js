const magick = require("../build/Release/image.node");
const { promisify } = require("util");

exports.run = async (message) => {
  message.channel.sendTyping();
  const image = await require("../utils/imagedetect.js")(message);
  if (image === undefined) return `${message.author.mention}, you need to provide a GIF to speed up!`;
  if (image.type !== "gif") return `${message.author.mention}, that isn't a GIF!`;
  const buffer = await promisify(magick.speed)(image.path, false, image.type.toUpperCase(), image.delay ? (100 / image.delay.split("/")[0]) * image.delay.split("/")[1] : 0);
  return {
    file: buffer,
    name: "speed.gif"
  };
};

exports.aliases = ["speedup", "fast", "gifspeed"];
exports.category = 5;
exports.help = "Makes a GIF faster";