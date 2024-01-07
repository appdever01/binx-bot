const PDFDocument = require('pdfkit');
const axios = require('axios');

module.exports = {
    name: 'topdf',
    aliases: ['pdf'],
    category: 'utils',
    exp: 10,
    description: 'Converts multiple images to PDF',
    async execute(client, flag, arg, M) {
        if (!M.quoted || (M.quoted && M.quoted.mtype !== 'imageMessage'))
            return M.reply('*Quote the images that you want to convert to PDF!*');
        
        const imageMessages = [M.quotedMsg, M];
        const pdfDoc = new PDFDocument();
        
        

        // Define the downloadImage function in client.utils
        client.utils.downloadImage = async (imageMessage) => {
        const imageUrl = imageMessage.message.imageMessage.url;
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        return Buffer.from(response.data, 'binary');
        };
        try {
            for (let i = 0; i < imageMessages.length; i++) {
                const imageBuffer = await client.utils.downloadImage(imageMessages[i]);
                pdfDoc.image(imageBuffer);
            }
            
            const pdfBuffer = await new Promise((resolve, reject) => {
                const buffers = [];
                pdfDoc.on('data', (buffer) => buffers.push(buffer));
                pdfDoc.on('end', () => resolve(Buffer.concat(buffers)));
                pdfDoc.end();
            });
            
            await client.sendMessage(
                M.from,
                { document: pdfBuffer, mimetype: 'application/pdf' },
                { quoted: M }
            );
        } catch (error) {
            client.log(error, 'red');
            return await M.reply('*Try Again*');
        }
    }
}