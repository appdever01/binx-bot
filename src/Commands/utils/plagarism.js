const hooke = require("hookejs");

module.exports = {
  name: 'checkplagiarism',
  aliases: ['cp'],
  category: 'utils',
  exp: 0,
  description: 'Checks for plagiarism in text.',
  async execute(client, arg, M) {
    try {
      const textToCheck = arg.join(" ");

      if (!textToCheck) {
        await client.sendMessage(M.from, { text: "Please provide some text to check for plagiarism." });
        return;
      }
      
      // Wait for the hooke.matchPrint() function to complete
      const result = await hooke.matchPrint({ text: textToCheck, threshold: 0.5 });
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