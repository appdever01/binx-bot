const { MessageType, Mimetype } = require("@whiskeysockets/baileys");
const { PDFDocument } = require('pdfkit');
const fs = require('fs');
const path = require('path');
const inPdfInput = [];
const bufferImagesForPdf = {};

module.exports = {
  name: 'pdfmode',
  aliases: ['pdfmode'],
  category: 'utils',
  exp: 15,
  description: 'Convert images to PDF',

  async execute(client, arg, M) {
    if (M.imageMessage) {
      M.reply("Send without image!");
      return;
    }

    inPdfInput.push(M.sender);
    bufferImagesForPdf[M.sender] = [];
    M.reply("Please send pictures one by one! Don't spam!");
  }
};

async function done(M, client) {
  if (inPdfInput.includes(M.sender)) {
    if (bufferImagesForPdf[M.sender].length > 19) {
      const pdf = new PDFDocument({ autoFirstPage: false });
      const bufferImages = bufferImagesForPdf[M.sender];
      for (const bufferImage of bufferImages) {
        const image = pdf.openImage(bufferImage);
        pdf.addPage({ size: [image.width, image.height] });
        pdf.image(image, 0, 0);
      }

      const tempDir = path.join(__dirname, '.temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      const pathFile = path.join(tempDir, Math.floor(Math.random() * 1000000 + 1) + ".pdf");
      const file = fs.createWriteStream(pathFile);
      pdf.pipe(file);
      pdf.end();

      file.on("finish", () => {
        const file = fs.readFileSync(pathFile);
        client.sendMessage(M.from, file, MessageType.document, { mimetype: Mimetype.pdf, filename: Math.floor(Math.random() * 1000000) + ".pdf", quoted: M });
        fs.unlinkSync(pathFile);
        inPdfInput.splice(inPdfInput.indexOf(M.sender), 1);
        delete bufferImagesForPdf[M.sender];
      });
    } else {
      client.sendMessage(M.from, { text: "Need more images! Send *!done* when finished, *!cancel* if you want to cancel" }, { quoted: M });
    }
  }
}

async function cancel(M, client) {
  if (inPdfInput.includes(M.sender)) {
    delete bufferImagesForPdf[M.sender];
    inPdfInput.splice(inPdfInput.indexOf(M.sender), 1);
    client.sendMessage(M.from, { text: "Operation cancelled!" }, { quoted: M });
  }
}