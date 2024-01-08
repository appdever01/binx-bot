const hooke = require('hookejs')

module.exports = {
    name: 'plagiarism',
    aliases: ['plagarism','check'],
    category: 'utils',
    exp: 100,
    description: "Detect, if using someone else's work without giving them proper credit",
    async execute(client, flag, context, M) {
        const content = context || (M.quoted && M.quoted.text)
        if (!content) return void M.reply('Provide the text you want to check as plagiarism!')
        const info = await hooke.autoCitation({ text: content, replace: true })
        const original = !info.split('Bibliography')[1].trim() ? ': None' : ''
        return void M.reply(info.trim() + original)
    }
}
