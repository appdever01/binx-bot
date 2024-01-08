module.exports = {
    name: 'imagetopdf',
    aliases: ['imgtopdf', 'pdf'],
    category: 'utils',
    exp: 100,
    description: 'Converts images into Pdf document',
    async execute(client, flag, context, M) {
        if (!context) return void M.reply('Provide some action e.g !pdf start !')
        const chat = client.images.get(M.sender)
        const actions = ['start', 'cancel', 'done']
        const action = context.trim().toLowerCase()
        if (!actions.includes(action)) return void M.reply(`Invaild action, try using *${actions.join(', ')}*`)
        if (!chat && action === 'start') {
            client.images.set(M.sender, { images: [] })
            return void M.reply('Okay, Send the images one by one!')
        }
        if (chat && action === 'cancel') {
            client.images.delete(M.sender)
            return void M.reply('You have cancelled your request!')
        }
        if (chat && action === 'done') {
            if (!chat.images.length) return void M.reply('Images, Not found!')
            const document = await client.utils.imagesToPDF(chat.images)
            await M.reply('Wait, While processing your request!')
            client.images.delete(M.sender)
            return void (await client.sendMessage(
                M.from,
                { document, mimetype: 'application/pdf', fileName: 'ImagesToPDF - Document.pdf' },
                { quoted: M }
            ))
        } else return void M.reply('You have not even start buddy!')
    }
}
