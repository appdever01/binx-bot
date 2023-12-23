module.exports = {
    name: 'eval',
    aliases: ['e'],
    category: 'dev',
    exp: 0,
    description: 'Evaluates JavaScript',
    async execute(client, flag, arg, M) {
        if (!arg) return M.reply('Sorry you did not give term!')
        if (M.sender != '923224875937@s.whatsapp.net') return void null
        let out = ''
        try {
            const output = (await eval(arg)) || 'Executed JS Successfully!'
            console.log(output)
            out = JSON.stringify(output)
        } catch (err) {
            out = err.message
        }
        return await M.reply(out)
    }
}
