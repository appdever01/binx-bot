const fs = require('fs');
const PDFDocument = require('pdfkit');

// Store temporary image buffers for PDF conversion
let imageBuffers = [];

module.exports = {
    name: 'topdf',
    aliases: ['pdf'],
    category: 'utils',
    exp: 15,
    description: 'convert images to pdf',
    async execute(client, flag, arg, M) {
        // Download the image and add its buffer to the collection
        const buffer = M.quoted ? await M.quoted.download() : await M.download();
        imageBuffers.push(buffer);

        // Provide feedback to the user that the image has been added to the PDF collection
        await client.sendMessage(M.from, 'Image added to PDF collection', { quoted: M });

        // Create a PDF document
        const pdfDoc = new PDFDocument();
        const pdfStream = fs.createWriteStream('output.pdf');

        pdfDoc.pipe(pdfStream);

        // Embed each image into the PDF as separate pages
        for (const buffer of imageBuffers) {
            pdfDoc.addPage().image(buffer, {
                fit: [pdfDoc.page.width, pdfDoc.page.height],
            });
        }

        pdfDoc.end();

        // Respond to the user with the PDF file
        pdfStream.on('finish', () => {
            client.sendMessage(M.from, { document: 'output.pdf' }, { quoted: M });
            // Clear the image buffer collection after creating the PDF
            imageBuffers = [];
        });

        // Provide feedback to the user that the PDF is being created
        await client.sendMessage(M.from, 'Creating PDF from images...', { quoted: M });
    }
}