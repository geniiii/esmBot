const magick = require("../build/Release/image.node");
const { promisify } = require("util");

exports.run = async (message) => {
  message.channel.sendTyping();
  const image = await require("../utils/imagedetect.js")(message);
  if (image === undefined) return `${message.author.mention}, you need to provide an image to make a "who did this" meme!`;
  const buffer = await promisify(magick.wdt)(image.path, image.type.toUpperCase(), image.delay ? (100 / image.delay.split("/")[0]) * image.delay.split("/")[1] : 0);
  return {
    file: buffer,
    name: `wdt.${image.type}`
  };
};

exports.aliases = ["whodidthis"];
exports.category = 5;
exports.help = "Creates a \"WHO DID THIS\" meme from an image";