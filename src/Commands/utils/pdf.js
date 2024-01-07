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

    let imageBuffer;
    const content = JSON.stringify(M.quoted)
    const isQuoted = M.type === 'extendedTextMessage' && content.includes('imageMessage')
        const isImage = isQuoted
            ? M.type === 'extendedTextMessage' && content.includes('imageMessage')
            : M.type === 'imageMessage'
        if (!isImage) return M.reply("You didn't provide an image")
     imageBuffer = isQuoted ? await M.quoted.download() : await M.download()

    try {
        // Initialize the PDF library
        const pdfDoc = await PDFlib.PDFDocument.create();

        const page = pdfDoc.addPage();
        const imgData = await pdfDoc.embedImage(imageBuffer);
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

        // Save the PDF document to a buffer
        const pdfBytes = await pdfDoc.save();

        // Send the PDF document to the user
        client.sendMessage(M.from, { document: pdfBytes, fileName: 'output.pdf', mimeType: 'application/pdf' });
    } catch (error) {
        console.error('An error occurred:', error);
        M.reply('Failed to convert to PDF');
    }
},
};