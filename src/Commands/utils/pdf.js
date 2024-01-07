module.exports = {
    name: 'topdf',
    aliases: ['pdf'],
    category: 'utils',
    exp: 15,
    description: 'convert images to pdf',
    async execute(client, arg, M) {
      if (!M.messageTypes(M.type) && !M.messageTypes(M.quoted.mtype))
return void M.reply('Caption/Quote an image')
let img = M.quoted ? await M.quoted.download() : await M.download()
let url = await uploadImage(img)    
let docname = text ? text : M.pushName || 'Binxer🤖'
client.sendMessage(M.from, `http://api.lolhuman.xyz/api/convert/imgtopdf?apikey=${lolkeysapi}&img=${url}`, docname + '.pdf', '', M, false, { asDocument: true })

    }
}