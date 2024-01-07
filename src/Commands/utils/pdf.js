const PDFlib = require('pdf-lib');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'topdf',
    aliases: ['pdf'],
    category: 'utils',
    exp: 15,
    description: 'Convert images to PDF',
    async execute(client, flag, arg, M) {
        if (!M || !M.body || !M.body.includes('!topdf')) {
            return void M.reply('Caption/Quote an image with /topdf');
        }

        const images = [];

        if (!M.quoted) {
            if (!M.hasMedia) return M.reply('Caption/Quote an image with /topdf');
            if (M.type !== 'image') return M.reply('Caption/Quote an image with /topdf');
            images.push(await M.download());
        } else {
            if (!M.quoted.hasMedia) return M.reply('Caption/Quote an image with /topdf');
            if (M.quoted.type !== 'image') return M.reply('Caption/Quote an image with /topdf');
            images.push(await M.quoted.download());
        }

        try {
            // Initialize the PDF library
            const pdfDoc = await PDFlib.PDFDocument.create();

            for (let image of images) {
                // Read the image file
                const imageData = fs.readFileSync(image);

                // Add the image to the PDF document
                const page = pdfDoc.addPage();
                const imgData = await pdfDoc.embedPng(imageData);
                const dims = pdfDoc.getPageDimensions(page);
                const scale = Math.min(dims.width / imgData.width, dims.height / imgData.height);
                page.drawImage(imgData, {
                    x: (dims.width - imgData.width * scale) / 2,
                    y: (dims.height - imgData.height * scale) / 2,
                    width: imgData.width * scale,
                    height: imgData.height * scale,
                });
            }

            // Save the PDF document to a buffer
            const pdfBytes = await pdfDoc.save();

            // Send the PDF document to the user
            client.sendMessage(M.from, { document: pdfBytes, fileName: 'output.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            console.error('An error occurred:', error);
            M.reply('Failed to convert to PDF');
        } finally {
            // Delete the temporary image files
            for (let image of images) {
                await fs.promises.unlink(image);
            }
        }
    },
};