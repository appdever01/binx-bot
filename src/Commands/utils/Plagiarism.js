const hooke = require("hookejs");

module.exports = {
  name: "plagiarism",
  aliases: ["plagarism"],
  category: "utils",
  exp: 100,
  description:
    "Detect, if using someone else's work without giving them proper credit",
  async execute(client, flag, context, M) {
    const content = context || (M.quoted && M.quoted.text);
    if (!content)
      return void M.reply("Provide the text you want to check as plagiarism!");
    const info = await hooke.autoCitation({ text: content, replace: true });
    const original = !info.split("Bibliography")[1].trim() ? ": None" : "";
    const replacedInfo = info.replace("Bibliography", "*Source found 🔎📝*");

    return void M.reply(`*Plagarism Found* ✅‼️✅\n\n` + replacedInfo);
  },
};
