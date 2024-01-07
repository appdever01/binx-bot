const FormData = require('form-data');
const Jimp = require('jimp');

module.exports = {
    name: 'enhance',
    aliases: ['enhance'],
    category: 'utils',
    exp: 15,
    description: 'make images clear ',
    async execute(client, flag, arg, M) {
client.hdr = client.hdr ? client.hdr : {};
				if (!M.messageTypes(M.type) && !M.messageTypes(M.quoted.mtype))
      return void M.reply("Caption/Quote an image/video/gif message");
				else client.hdr[M.sender] = true;
				M.reply('Okay please wait, I am processing the image 🤓');
				let img = M.quoted ? await M.quoted.download() : await M.download();
				let error;
				try {
					const This = await processing(img, "enhance");
					client.sendMessage(M.from, This, "", "Here i have made the image to be clear 🥲", m);
				} catch (er) {
					error = true;
				} finally {
					if (error) {
						M.reply("🤖 :(");
					}
				};

async function processing(urlPath, method) {
  return new Promise((resolve, reject) => {
    let Methods = ["enhance", "recolor", "dehaze"];
    method = Methods.includes(method) ? method : Methods[0];
    let buffer,
      Form = new FormData(),
      scheme = "https://inferenceengine.vyro.ai/" + method;
    Form.append("model_version", 1, {
      "Content-Transfer-Encoding": "binary",
      contentType: "multipart/form-data; charset=utf-8",
    });
    Form.append("image", Buffer.from(urlPath), {
      filename: "enhance_image_body.jpg",
      contentType: "image/jpeg",
    });
    Form.submit(
      {
        url: scheme,
        host: "inferenceengine.vyro.ai",
        path: "/" + method,
        protocol: "https:",
        headers: {
          "User-Agent": "okhttp/4.9.3",
          Connection: "Keep-Alive",
          "Accept-Encoding": "gzip",
        },
      },
      function (err, res) {
        if (err) {
          reject(err); // Pass the error object to the reject function
          return;
        }
        let data = [];
        res
          .on("data", function (chunk) {
            data.push(chunk);
          })
          .on("end", () => {
            resolve(Buffer.concat(data));
          })
          .on("error", (e) => {
            reject(e); // Pass the error object to the reject function
          });
      }
    );
  });
}
    }}