const Jimp = require('jimp')

module.exports = {
    name: 'enhance',
    aliases: ['e'],
    category: 'utils',
    exp: 15,
    description: 'enhance [quote message containing image]',
    async execute(client, flag, arg, M) {
        if (!M.messageTypes(M.type) && (!M.quoted || !M.messageTypes(M.quoted.mtype)))
            return void M.reply('Quote an image message to enhance')
        const buffer = M.quoted ? await M.quoted.download() : await M.download()
        if (!buffer) return void M.reply('Failed to download the image')
        const enhance = await Jimp.read(buffer)
        const sharpeningFactor = 1.2
        const sharpened = enhance.convolute([
            [-1, -1, -1],
            [-1, 9 + sharpeningFactor, -1],
            [-1, -1, -1]
        ])
        const image = await sharpened.getBufferAsync(Jimp.MIME_JPEG)
        return void (await client.sendMessage(M.from, { image }, { quoted: M }))
    }
}
