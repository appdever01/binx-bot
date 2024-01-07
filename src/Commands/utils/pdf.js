const PDFDocument = require('pdfkit');
const fs = require('fs');

module.exports = {
    name: 'imagesToPdf',
    aliases: ['itp'],
    category: 'utils',
    exp: 15,
    description: 'Convert multiple images to PDF',
    async execute(client, flag, arg, M) {
        if (!M.messageTypes(M.type) && (!M.quoted || !M.messageTypes(M.quoted.mtype)))
            return void M.reply('Quote multiple image messages to convert to PDF');

        const images = [];
        if (M.quoted) {
            const quotedMessages = await M.getQuotedMessages();
            for (const quotedMessage of quotedMessages) {
                if (quotedMessage.mtype === 'image') {
                    const buffer = await quotedMessage.download();
                    images.push(buffer);
                }
            }
        } else {
            const downloadedImages = await M.downloadAllMedia();
            for (const downloadedImage of downloadedImages) {
                if (downloadedImage.mtype === 'image') {
                    images.push(downloadedImage.data);
                }
            }
        }

        if (images.length === 0) {
            return void M.reply('No images found to convert to PDF');
        }

        const pdfDoc = new PDFDocument();
        const pdfPath = 'converted_images.pdf';

        for (const image of images) {
            pdfDoc.image(image);
        }

        pdfDoc.pipe(fs.createWriteStream(pdfPath));
        pdfDoc.end();

        await client.sendMessage(M.from, { document: fs.readFileSync(pdfPath) }, { quoted: M });
        fs.unlinkSync(pdfPath);
    }
}