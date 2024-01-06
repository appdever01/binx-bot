const PDFlib = require('pdf-lib');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'topdf',
    aliases: ['pdf'],
    category: 'utils',
    exp: 15,
    description: 'Convert images to PDF',
    async execute(client, arg, M, body) {
        if (!M.body.includes('/topdf')) return void M.reply('Caption/Quote an image with /topdf');

        if (!M.quoted) {
            if (!M.hasMedia) return M.reply('Caption/Quote an image with /topdf');
            if (M.type !== 'image') return M.reply('Caption/Quote an image with /topdf');
            M.download('image.jpg');
        } else {
            if (!M.quoted.hasMedia) return M.reply('Caption/Quote an image with /topdf');
            if (M.quoted.type !== 'image') return M.reply('Caption/Quote an image with /topdf');
            M.quoted.download('image.jpg');
        }

        let images = [];
        images.push(fs.readFileSync('image.jpg'));

        try {
            // Initialize the PDF library
            const pdfDoc = await PDFlib.PDFDocument.create();

            for (let image of images) {
                const page = pdfDoc.addPage();
                const imgData = await pdfDoc.embedPng(image);
                const dims = pdfDoc.getPageDimensions(page);

                // Calculate the scaling factor to fit the image on the page
                const scale = Math.min(dims.width / imgData.width, dims.height / imgData.height);

                // Add the image to the page
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
            // Delete the temporary image file
            await fs.promises.unlink('image.jpg');
        }
    },
};