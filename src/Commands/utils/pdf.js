const PDFDocument = require('pdfkit');

module.exports = {
    name: 'topdf',
    aliases: ['pdf'],
    category: 'utils',
    exp: 10,
    description: 'Converts multiple images to PDF',
    async execute(client, flag, arg, M) {
        if (!M.hasQuotedMsg || !M.quotedMsg.hasMedia || !M.hasMedia)
            return M.reply('*Send or quote the images that you want to convert to PDF!*');
        
        const imageMessages = [M.quotedMsg, M];
        const pdfDoc = new PDFDocument();
        
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