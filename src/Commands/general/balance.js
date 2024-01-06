module.exports = {
    name: 'balance',
    aliases: ['credit'],
    category: 'general',
    exp: 10,
    description: 'Show your credit amount',
    async execute(client, flag, arg, M) {
        let info = await client.daily.get(M.sender)
        if (!info) {
            info = { credit: 5, count: 0 }
            await client.daily.set(M.sender, info)
        }
        return void M.reply(`Your Remaining credit: $${parseFloat(info.credit).toFixed(2)}`)
    }
}
