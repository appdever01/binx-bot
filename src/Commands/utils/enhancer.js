const sharp = require('sharp');

module.exports = {
    name: 'enhance',
    aliases: ['e'],
    category: 'utils',
    exp: 15,
    description: 'enhance [quote message containing image]',
    async execute(client, flag, arg, M) {
        if (!M.messageTypes(M.type) && !M.messageTypes(M.quoted.mtype))
            return void M.reply('Quote an image message to enhance');
        
        const buffer = await M.quoted.download();
        const enhancedImageBuffer = await sharp(buffer)
            .sharpen()
            .toBuffer();
        
        await client.sendMessage(M.from, { image: enhancedImageBuffer }, { quoted: M });
    }
}