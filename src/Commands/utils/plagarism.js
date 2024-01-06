const hooke = require("hookejs");

module.exports = {
  name: 'fake',
  aliases: ['f'],
  category: 'utils',
  exp: 0,
  description: 'Detects plagiarism in text.',
  async execute(client, arg, M) {
    try {
      const plagiarisedText = arg.slice(1).join(" ");

      if (!plagiarisedText) {
        await client.sendMessage(M.from, { text: "Please provide some text to check for plagiarism." });
        return;
      }

      // Wait for the hooke.matchPrint() function to complete
      const result = await hooke.matchPrint({ text: plagiarisedText, threshold: 0.5 });
      let response = result ? "Plagiarism detected!" : "No plagiarism found.";
      await client.sendMessage(M.from, { text: response });
      console.log(response);
    } catch (error) {
      console.error("An error occurred:", error.message);
      const errorMessage = "Oops! Something went wrong. Please try again later.";
      await client.sendMessage(M.from, { text: errorMessage });
    }
  }
};