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
        
        const brightnessFactor = 0.8; // Adjust the brightness factor as needed
        
        if (brightnessFactor < -1 || brightnessFactor > 1) {
            return void M.reply('Brightness factor must be a number between -1 and +1');
        }
        
        // Send a message indicating that the image is being processed
        await M.reply('Processing the image. Please wait...');
        
        image.brightness(brightnessFactor);
        
        // Increase the resolution to make the image HD
        image.resize(1920, 1080); // Adjust the dimensions as needed
        
        // Apply a sharpening filter to make the image look sharp
        image.sharpen(0.5); // Adjust the sharpening factor as needed
        
        const enhancedImageBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
        
        await client.sendMessage(M.from, { image: enhancedImageBuffer }, { quoted: M });
    }
}