module.exports = {
    name: 'voicemode',
    aliases: ['vm'],
    category: 'general',
    exp: 30,
    description: 'Enable/Disable voicenote mode in DM',
    async execute(client, flags, context, M) {
        const action = context.trim().toLowerCase()
        if (!['enable', 'disable'].includes(action)) return void M.reply('Provide the (enable/disable) to command')
        let info = await client.daily.get(M.sender)
        const voice = action === 'enable'
        if (!info) info = { daily: 0, subscription: 'None', count: 0, voice }
        info.voice = voice
        await client.daily.set(M.sender, info)
        return void M.reply(`${voice ? '🟩 Enable' : '🟥 Disable'} voicenote mode`)
    }
}
