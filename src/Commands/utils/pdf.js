const PDFDocument = require('pdfkit');

module.exports = {
    name: 'pdf',
    aliases: ['itp'],
    category: 'utils',
    exp: 10,
    description: 'Converts multiple images to PDF',
    async execute(client, flag, arg, M) {
      
        const content = JSON.stringify(M.quoted);
        const isQuoted = M.type === 'extendedTextMessage' && content.includes('imageMessage');
        const isImage = isQuoted ? M.type === 'extendedTextMessage' && content.includes('imageMessage') : M.type === 'imageMessage';
        
        if (!isImage) return M.reply("You didn't provide any images");
        
        const images = isQuoted ? await M.quoted.downloadAll() : await M.downloadAll();
        const pdfDoc = new PDFDocument();
        
        images.forEach((image) => {
            pdfDoc.image(image);
        });
        
        const pdfBuffer = await new Promise((resolve) => {
            const buffers = [];
            pdfDoc.on('data', (buffer) => buffers.push(buffer));
            pdfDoc.on('end', () => resolve(Buffer.concat(buffers)));
            pdfDoc.end();
        });
        
        await client.sendMessage(
            M.from,
            {
                document: pdfBuffer,
                mimetype: 'application/pdf',
                filename: 'converted_images.pdf'
            },
            {
                quoted: M
            }
        );
    }
};