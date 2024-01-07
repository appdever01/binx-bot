const Jimp = require('jimp');

module.exports = {
    name: 'enhance',
    aliases: ['e'],
    category: 'utils',
    exp: 15,
    description: 'enhance [quote message containing image]',
    async execute(client, flag, arg, M) {
        if (!M.messageTypes(M.type) && (!M.quoted || !M.messageTypes(M.quoted.mtype)))
            return void M.reply('Quote an image message to enhance');
        
        const buffer = M.quoted ? await M.quoted.download() : await M.download();
        
        if (!buffer) {
            return void M.reply('Failed to download the image');
        }
        
        const image = await Jimp.read(buffer);
        
        const sharpeningFactor = 1.5; // Adjust the sharpening factor as needed
        const sharpened = image.convolute([
            [-1, -1, -1],
            [-1, 9 + sharpeningFactor, -1],
            [-1, -1, -1]
        ]);
        
        const enhancedImageBuffer = await sharpened.getBufferAsync(Jimp.MIME_JPEG);
        
        await client.sendMessage(M.from, { image: enhancedImageBuffer }, { quoted: M });
    }
}