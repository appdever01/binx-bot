const { ChatGPTHelperPrompt, transcribe, wikipedia, google, countryTime, weather, toSpeech } = require('../lib/Helper')
const YT = require('../lib/YT')
const axios = require('axios')
const yts = require('yt-search')
const { Sticker } = require('wa-sticker-formatter')
const { Keys, complement } = require('../lib/Messages')
const { serialize, decodeJid } = require('../lib/WAclient')
const { getStats } = require('../lib/stats')
const { Configuration, OpenAIApi } = require('openai')
const { audioToSlice, audioMerge } = require('audio-slicer')
const emojis = require('emoji-strip')
const fs = require('fs')
const path = require('path')
const FormData = require('form-data')
const chalk = require('chalk')
const currentUTCTime = new Date().toUTCString()
const messageCost = 0.006
const plagarismCost = 0.0004
const pdfCost = 0.054
const enhancerCost = 0.034
const transcription = 0.014
const imagecost = 0.044
const stickercost = 0.009
const aiimagecost = 0.044
let helper = ''

module.exports = async ({ messages }, client) => {
    const M = serialize(messages[0], client)
    if (!M.message || ['protocolMessage', 'senderKeyDistributionMessage'].includes(M.type) || !M.type) return null
    const { isGroup, sender, from, body } = M
    const result = isGroup ? await client.groupMetadata(from) : {}
    const admins = isGroup ? result.participants.filter(({ admin }) => admin).map(({ id }) => id) : []
    client.isAdmin = isGroup && admins?.includes(decodeJid(client.user?.id))
    await moderate(M, client, admins, body)
    const args = body.trim().split(' ')
    const isCmd = args[0].startsWith(client.prefix)
    const chat = client.images.get(M.sender)
    if (chat && M.type === 'imageMessage') {
        const image = await M.download()
        const images = chat.images || []
        images.push(image)
        client.images.set(M.sender, { images })
        return void M.reply(`*Added image Page: ${images.length}*`)
    }
    let info = await client.daily.get(M.sender)
    if (!info) {
        info = { credit: 0.2, count: 0 }
        await client.daily.set(M.sender, info)
    }
    let { credit, count } = info
    const conditions = [isCmd, isGroup, M.key.fromMe]
    if (!conditions.some(Boolean)) {
        if (credit < messageCost) return void M.reply('Insufficient credit. \n\nKindly visit binxai.tekcify.com/pay to add or buy more credits')
        info.credit = credit - messageCost
        info.count = count + 1
        await client.daily.set(M.sender, info)
        console.log(`Remaining credit 💰: $${parseFloat(info.credit).toFixed(3)}\n\nYou can visit binxai.tekcify.com/pay to add or buy more credits`)
        let result = await ChatGPTHelper(client.apiKey, body)
        if (!/^{(\s*".*"\s*:\s*".*"\s*)}$/.test(result)) result = '{ "normal": null }'
        const type = JSON.parse(result)
        if (Keys.includes(M.type) && !type.dosticker) {
            const message = complement(M.type)
            return void M.reply(message)
        }
        if (M.type === 'audioMessage') {
            const voice = M.message?.audioMessage?.ptt
            await M.reply(voice ? '👩🏻👂🎧' : '👩🏻🎧✍️')
            if (!voice) {
                let text = 'Write a Quick and Short Summary of text below:\n\n'
                const duration = M.message?.audioMessage?.seconds
                if (duration > 600) return void M.reply('You are only allowed to use audio less than 10 minutes')
                if (duration > 75) {
                    const audios = await audioToSlice(await M.download(), 75)
                    if (!audios || !audios.length) return void M.reply('An error occurred')
                    if (audios.length) {
                        const total = audios.length
                        for (let i = 0; i < total; i++) {
                            const result = await transcribe(audios[i], client)
                            text += result + '\n'
                            await M.reply(`🎙️ *${1 + i}/${total}* ▶️ _"${result}"_`)
                            info.credit = credit - (messageCost + transcription)
                            await client.daily.set(M.sender, info)
                        }
                    }
                    return void (await chatGPT(M, client, text))
                }
                const result = await transcribe(await M.download(), client)
                await M.reply(`🎙️ *1/1* ▶️ _"${result}"_`)
                text += result
                return void (await chatGPT(M, client, text))
            }
            const result = await transcribe(await M.download(), client)
            await M.reply(`I heard you saying 👩🏻👂🎧\n\n _"${result}_"`)
            let chatGPTResult = await ChatGPTHelper(client.apiKey, result)
            if (!/^{\s*".*"\s*}$/.test(chatGPTResult)) chatGPTResult = '{ "normal": null }'
            const type = JSON.parse(chatGPTResult)
            console.log(type)
            if (type.google) {
                helper = await google(type.google)
                await M.reply('👨🏻‍💻🔎')
            } else if (type.time) {
                helper = await countryTime(type.time)
                await M.reply('👨🏻‍💻⏰⌚️')
            } else if (type.weather) {
                helper = await weather(type.weather)
                await M.reply('👨🏻‍💻🔎☀️🌡')
            } else if (type.voice) {
                info.voice = type.voice
                await client.daily.set(M.sender, info)
                
                helper = type.voice ? '🟩 Enable' : '🟥 Disable'
            } else if (type.videosearch) {
                await M.reply('👨🏻‍💻🔎🎥')
                const link = async (term) => {
                    const { videos } = await yts(term.trim())
                    if (!videos || !videos.length) return null
                    return videos[0].url
                }
                const term = await link(type.videosearch)
                if (!term) return M.reply('Please provide a valid video name 💜')
                const { videoDetails } = await YT.getInfo(term)
                M.reply('Downloading has started, please wait.')
                let text = `*Title:* ${videoDetails.title} | *Type:* Video | *From:* ${videoDetails.ownerChannelName}`
                client.sendMessage(
                    M.from,
                    {
                        image: {
                            url: `https://i.ytimg.com/vi/${videoDetails.videoId}/maxresdefault.jpg`
                        },
                        caption: text
                    },
                    {
                        quoted: M
                    }
                )
                if (Number(videoDetails.lengthSeconds) > 1800)
                    return M.reply('Cannot download videos longer than 30 minutes')
                const audio = YT.getBuffer(term, 'video')
                    .then(async (res) => {
                        await client.sendMessage(
                            M.from,
                            {
                                document: res,
                                mimetype: 'video/mp4',
                                fileName: videoDetails.title + '.mp4'
                            },
                            {
                                quoted: M
                            }
                        )
                    })
                    .catch((err) => {
                        return M.reply(err.toString())
                        client.log(err, 'red')
                    })
                return true
            } else if (type.audiosearch) {
                const link = async (term) => {
                    const { videos } = await yts(term.trim())
                    if (!videos || !videos.length) return null
                    return videos[0].url
                }
                const term = await link(type.audiosearch)
                if (!term) return M.reply('Please provide a valid audio name 💜')
                const { videoDetails } = await YT.getInfo(term)
                M.reply('Downloading has started, please wait.')
                let text = `*Title:* ${videoDetails.title} | *Type:* Audio | *From:* ${videoDetails.ownerChannelName}`
                client.sendMessage(
                    M.from,
                    {
                        image: {
                            url: `https://i.ytimg.com/vi/${videoDetails.videoId}/maxresdefault.jpg`
                        },
                        caption: text
                    },
                    {
                        quoted: M
                    }
                )
                if (Number(videoDetails.lengthSeconds) > 1800)
                    return M.reply('Cannot download audio longer than 30 minutes')
                const audio = YT.getBuffer(term, 'audio')
                    .then(async (res) => {
                        await client.sendMessage(
                            M.from,
                            {
                                document: res,
                                mimetype: 'audio/mpeg',
                                fileName: videoDetails.title + '.mp3'
                            },
                            {
                                quoted: M
                            }
                        )
                    })
                    .catch((err) => {
                        return M.reply(err.toString())
                        client.log(err, 'red')
                    })
                return true
            } else if (type.imaginesearch) {
                async function uploadImage() {
                    const url = 'https://api.dezgo.com/text2image'
                    const apiKey = 'DEZGO-B9BCCE2A00DEFD915A8C412062A9B76389A828DD2E21B03E8A57B2C4056E416C6CE54D91'
                    const form = new FormData()
                    form.append('prompt', type.imaginesearch)
                    form.append('negative_prompt', 'ugly, poorly drawn, deformed, deformed limbs')
                    form.append('guidance', '8')
                    form.append('seed', '568542368')
                    const headers = {
                        'content-type': 'application/x-www-form-urlencoded',
                        'X-Dezgo-Key': apiKey
                    }
                    try {
                        await M.reply('📸🔮🪄')
                        const response = await axios.post(url, form, { headers, responseType: 'arraybuffer' })
                        const imageBuffer = Buffer.from(response.data, 'binary')
                        const randomString = Math.random().toString(36).substring(7)
                        const filename = `random_${randomString}_${Date.now()}.png`
                        const imagePath = path.join(__dirname, filename)
                        console.log(imagePath)
                        fs.writeFileSync(imagePath, imageBuffer)
                        console.log('Image saved successfully')
                        await client.sendMessage(M.from, {
                            image: {
                                url: imagePath
                            },
                            caption: 'Imagination brought to life by Binx! 😌💙🔥'
                        })
                        info.credit = credit - (messageCost + aiimagecost)
                        await client.daily.set(M.sender, info)
                        return true
                    } catch (error) {
                        console.error('There was an error:', error)
                        return M.reply('Could not generate the image.')
                    }
                }
                uploadImage()
                return true
            } else if (type.dosticker) {
                if (!M.messageTypes(M.type) && !M.messageTypes(M.quoted.mtype))
                    return void M.reply('Caption/Quote an image/video/gif message')
                const buffer = M.quoted ? await M.quoted.download() : await M.download()
                const sticker = await new Sticker(buffer, {
                    pack: 'Crafted by',
                    author: 'Binx AI 🔥',
                    categories: ['🤩', '🎉'],
                    quality: 70,
                    type: 'full'
                }).build()
                info.credit = credit - (messageCost + stickercost)
                await client.daily.set(M.sender, info)
                return void (await client.sendMessage(M.from, { sticker }, { quoted: M }))
            }  else if (type.lyrics) {
                await M.reply('👨🏻‍💻🔎🎵')
                const data = await client.utils.fetch(`https://weeb-api.vercel.app/genius?query=${type.lyrics}`)
                if (!data.length) return void M.reply("Couldn't find any lyrics")
                const image = await client.utils.getBuffer(data[0].image)
                let caption = `🔖 *Title:* ${data[0].title} *(${data[0].fullTitle})*\n🏮 *Artist:* ${data[0].artist}`
                const lyrics = await client.utils.fetch(`https://weeb-api.vercel.app/lyrics?url=${data[0].url}`)
                caption += `\n\n ${lyrics}`
                return void (await client.sendMessage(M.from, { image, caption }, { quoted: M }))
            } else if (Keys.includes(M.type)) {
                const message = complement(M.type)
                return void M.reply(message)
            } else if (type.gisearch) {
                await M.reply('👨🏻‍💻🔎📸')
                const images = await client.utils.fetch(`https://weeb-api.vercel.app/gisearch?query=${type.gisearch}`)
                if (!images.length) return void M.reply('Not Found')
                for (let i = 0; i < 4; i++) {
                    const url = images[Math.floor(Math.random() * images.length)]
                    await client.sendMessage(M.from, { image: { url } }, { quoted: M })
                }
                info.credit = credit - (messageCost + imagecost)
                await client.daily.set(M.sender, info)
                return void M.reply(`Binx AI © ${new Date().getFullYear()} 💜😇📸`)
                
            } else {
                await M.reply('👨🏻‍💻💬⌨')
            }
            return void (await chatGPT(M, client, result, type?.voice))
        }
        if (!body) return void null
        if (type.google) {
            helper = await google(type.google)
            await M.reply('👨🏻‍💻🔎')
        } else if (type.time) {
            helper = await countryTime(type.time)
            await M.reply('👨🏻‍💻⏰⌚️')
        } else if (type.weather) {
            helper = await weather(type.weather)
            await M.reply('👨🏻‍💻🔎☀️🌡')
        } else if (type.voice) {
            info.voice = type.voice
            await client.daily.set(M.sender, info)
            helper = type.voice ? '🟩 Enable' : '🟥 Disable'
        } else if (type.videosearch) {
            await M.reply('👨🏻‍💻🔎🎥')
            const link = async (term) => {
                const { videos } = await yts(term.trim())
                if (!videos || !videos.length) return null
                return videos[0].url
            }
            const term = await link(type.videosearch)
            if (!term) return M.reply('Please provide a valid video name 💜')
            const { videoDetails } = await YT.getInfo(term)
            M.reply('Downloading has started, please wait.')
            let text = `*Title:* ${videoDetails.title} | *Type:* Video | *From:* ${videoDetails.ownerChannelName}`
            client.sendMessage(
                M.from,
                {
                    image: {
                        url: `https://i.ytimg.com/vi/${videoDetails.videoId}/maxresdefault.jpg`
                    },
                    caption: text
                },
                {
                    quoted: M
                }
            )
            if (Number(videoDetails.lengthSeconds) > 1800)
                return M.reply('Cannot download videos longer than 30 minutes')
            const audio = YT.getBuffer(term, 'video')
                .then(async (res) => {
                    await client.sendMessage(
                        M.from,
                        {
                            document: res,
                            mimetype: 'video/mp4',
                            fileName: videoDetails.title + '.mp4'
                        },
                        {
                            quoted: M
                        }
                    )
                })
                .catch((err) => {
                    return M.reply(err.toString())
                    client.log(err, 'red')
                })
            return true
        } else if (type.audiosearch) {
            const link = async (term) => {
                const { videos } = await yts(term.trim())
                if (!videos || !videos.length) return null
                return videos[0].url
            }
            const term = await link(type.audiosearch)
            if (!term) return M.reply('Please provide a valid audio name 💜')
            const { videoDetails } = await YT.getInfo(term)
            M.reply('Downloading has started, please wait.')
            let text = `*Title:* ${videoDetails.title} | *Type:* Audio | *From:* ${videoDetails.ownerChannelName}`
            client.sendMessage(
                M.from,
                {
                    image: {
                        url: `https://i.ytimg.com/vi/${videoDetails.videoId}/maxresdefault.jpg`
                    },
                    caption: text
                },
                {
                    quoted: M
                }
            )
            if (Number(videoDetails.lengthSeconds) > 1800)
                return M.reply('Cannot download audio longer than 30 minutes')
            const audio = YT.getBuffer(term, 'audio')
                .then(async (res) => {
                    await client.sendMessage(
                        M.from,
                        {
                            document: res,
                            mimetype: 'audio/mpeg',
                            fileName: videoDetails.title + '.mp3'
                        },
                        {
                            quoted: M
                        }
                    )
                })
                .catch((err) => {
                    return M.reply(err.toString())
                    client.log(err, 'red')
                })
            return true
        } else if (type.imaginesearch) {
            async function uploadImage() {
                const url = 'https://api.dezgo.com/text2image'
                const apiKey = 'DEZGO-B9BCCE2A00DEFD915A8C412062A9B76389A828DD2E21B03E8A57B2C4056E416C6CE54D91'
                const form = new FormData()
                form.append('prompt', type.imaginesearch)
                form.append('negative_prompt', 'ugly, poorly drawn, deformed, deformed limbs')
                form.append('guidance', '8')
                form.append('seed', '568542368')
                const headers = {
                    'content-type': 'application/x-www-form-urlencoded',
                    'X-Dezgo-Key': apiKey
                }
                try {
                    await M.reply('📸🔮🪄')
                    const response = await axios.post(url, form, { headers, responseType: 'arraybuffer' })
                    const imageBuffer = Buffer.from(response.data, 'binary')
                    const randomString = Math.random().toString(36).substring(7)
                    const filename = `random_${randomString}_${Date.now()}.png`
                    const imagePath = path.join(__dirname, filename)
                    console.log(imagePath)
                    fs.writeFileSync(imagePath, imageBuffer)
                    console.log('Image saved successfully')
                    await client.sendMessage(M.from, {
                        image: {
                            url: imagePath
                        },
                        caption: 'Imagination brought to life by Binx! 😌💙🔥'
                    })
                    info.credit = credit - (messageCost + imagecost)
                    await client.daily.set(M.sender, info)
                    return true
                } catch (error) {
                    console.error('There was an error:', error)
                    return M.reply('Could not generate the image.')
                }
            }
            uploadImage()
            return true
        } else if (type.dosticker) {
            if (!M.messageTypes(M.type) && !M.messageTypes(M.quoted.mtype))
                return void M.reply('Caption/Quote an image/video/gif message')
            const buffer = M.quoted ? await M.quoted.download() : await M.download()
            const sticker = await new Sticker(buffer, {
                pack: 'Crafted by',
                author: 'Binx AI 🔥',
                categories: ['🤩', '🎉'],
                quality: 70,
                type: 'full'
            }).build()
            info.credit = credit - (messageCost + stickercost)
              await client.daily.set(M.sender, info)
            return void (await client.sendMessage(M.from, { sticker }, { quoted: M }))
        } else if (type.lyrics) {
            await M.reply('👨🏻‍💻🔎🎵')
            const data = await client.utils.fetch(`https://weeb-api.vercel.app/genius?query=${type.lyrics}`)
            if (!data.length) return void M.reply("Couldn't find any lyrics")
            const image = await client.utils.getBuffer(data[0].image)
            let caption = `🔖 *Title:* ${data[0].title} *(${data[0].fullTitle})*\n🏮 *Artist:* ${data[0].artist}`
            const lyrics = await client.utils.fetch(`https://weeb-api.vercel.app/lyrics?url=${data[0].url}`)
            caption += `\n\n ${lyrics}`
            return void (await client.sendMessage(M.from, { image, caption }, { quoted: M }))
        } else if (Keys.includes(M.type)) {
            const message = complement(M.type)
            return void M.reply(message)
        } else if (type.gisearch) {
            await M.reply('👨🏻‍💻🔎📸')
            const images = await client.utils.fetch(`https://weeb-api.vercel.app/gisearch?query=${type.gisearch}`)
            if (!images.length) return void M.reply('Not Found')
            for (let i = 0; i < 4; i++) {
                const url = images[Math.floor(Math.random() * images.length)]
                await client.sendMessage(M.from, { image: { url } }, { quoted: M })
            }
            info.credit = credit - (messageCost + imagecost)
                await client.daily.set(M.sender, info)
            return void M.reply(`Binx AI © ${new Date().getFullYear()} 💜😇📸`)
        } else {
            await M.reply('👨🏻‍💻💬⌨')
        }
        return void (await chatGPT(M, client, body, info?.voice))
    }
    if (!args[0] || !args[0].startsWith(client.prefix))
        return void client.log(
            `${chalk.cyanBright('Message')} from ${chalk.yellowBright(M.pushName)} in ${chalk.blueBright(
                result.subject || 'DM'
            )}`
        )
    client.log(
        `${chalk.cyanBright(`Command ${args[0]}[${args.length - 1}]`)} from ${chalk.yellowBright(
            M.pushName
        )} in ${chalk.blueBright(result.subject || 'DM')}`
    )
    const cmd = args[0].toLowerCase().slice(client.prefix.length)
    const { context, flags } = formatArgs(args)
    const banned = (await client.DB.get('banned'))?.includes(M.sender) || false
    if (banned) return M.reply('You are banned from using the bot')
    const command = client.cmd.get(cmd) || client.cmd.find((command) => command.aliases?.includes(cmd))
    if (!command) return void M.reply('No such command found buddy!')
    if (command.name === 'imagetopdf') {
        if (credit < pdfCost) return void M.reply('Insufficient credit. \n\nKindly visit binxai.tekcify.com/pay to add buy more credits')
        info.credit = credit - (messageCost + pdfCost)
        info.count = count + 1
        await client.daily.set(M.sender, info)
        console.log(`Remaining credit 💰: $${parseFloat(info.credit).toFixed(3)}`)
    }
     else if (command.name === 'enhance') {
        if (credit < enhancerCost) return void M.reply('Insufficient credit. \n\nKindly visit binxai.tekcify.com/pay to add buy more credits')
        info.credit = credit - (messageCost + enhancerCost)
        info.count = count + 1
        await client.daily.set(M.sender, info)
        console.log(`Remaining credit 💰: $${parseFloat(info.credit).toFixed(3)}`)
    }
    else if (command.name === 'plagiarism') {
        if (credit < plagarismCost) return void M.reply('Insufficient credit. \n\nKindly visit binxai.tekcify.com/pay to add buy more credits')
        info.credit = credit - (messageCost + plagarismCost)
        info.count = count + 1
        await client.daily.set(M.sender, info)
        console.log(`Remaining credit 💰: $${parseFloat(info.credit).toFixed(3)}`)
    }
    
    if (!admins.includes(sender) && command.category === 'moderation')
        return void M.reply('This command can only be used by group or community admins')
    if (!client.isAdmin && command.category === 'moderation')
        return void M.reply('This command can only be used when bot is admin')
    if (!isGroup && command.category === 'moderation') return void M.reply('This command is meant to use in groups')
    if (!client.mods.includes(sender) && command.category === 'dev')
        return void M.reply('This command only can be accessed by the mods')
    try {
        await command.execute(client, flags, context, M)
    } catch (error) {
        client.log(error.message, 'red')
    }
}

const formatArgs = (args) => {
    args.splice(0, 1)
    return {
        args,
        context: args.join(' ').trim(),
        flags: args.filter((arg) => arg.startsWith('--'))
    }
}

const moderate = async (M, client, admins, body) => {
    const mods = (await client.DB.get('mod'))?.includes(M.from) || false
    if (!M.isGroup) return void null
    if (!mods || admins.includes(M.sender) || !client.isAdmin) return void null
    const urls = client.utils.extractUrls(body)
    const groupInvites = urls.filter((url) => /chat.whatsapp.com\/(?:invite\/)?([\w\d]*)/.test(url))
    for (const invite of groupinvites) {
        const code = await client.groupInviteCode(M.from)
        const inviteSplit = invite.split('/').pop()
        if (inviteSplit !== code) {
            await client.sendMessage(M.from, { delete: M.key })
            return void (await client.groupParticipantsUpdate(M.from, [M.sender], 'remove'))
        }
    }
}

const createSpeech = async (client, text) => {
    const audios = await toSpeech(text)
    if (!audios.length) return 'Unable to make long text as audio'
    const audio = await audioMerge(audios)
    const buffer = await client.utils.mp3ToOpus(audio)
    return buffer
}

const ChatGPTHelper = async (apiKey, context) => {
    if (!apiKey) return null
    const trimmedContext = context.trim()
    const ai = new OpenAIApi(new Configuration({ apiKey }))
    try {
        const response = await ai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: ChatGPTHelperPrompt.trim()
                },
                {
                    role: 'user',
                    content: context
                }
            ]
        })
        const res = response.data.choices[0]?.message
        return res?.content
    } catch (error) {
        console.log(error.message)
        return '{ "normal": null }'
    }
}

const chatGPT = async (M, client, context, voice = false) => {
    const { apiKey } = client
    if (!apiKey) return null
    const ai = new OpenAIApi(new Configuration({ apiKey }))
    if (helper) helper = `\n\nchatGPT Helper: ${helper}`

    try {
        const messages = (await client.messagesMap.get(M.from)) || []
        const prompt = `You are Binx Ai, a friendly WhatsApp AI Bot developed by Tekcify 💜🪄. Your goal is to engage in mutual conversations with humans, using emojis and maintaining a funny and friendly tone 🥹❤️.  You can can listen to voice notes, reply in voice notes, generate AI images, convert images to pdf using '!pdf start' command , enhance image using '!enhance' command and check for plagarism using !plagarism command,send images, search for videos and music, find song lyrics, and provide weather information, turn image to stickers. You are not using any GPT model or affiliated with OpenAI or GPT in any way . For feedback or inquiries or subscribing to binx, users can contact Tekcify on IG @tekcify or visit binxai.tekcify.com. Never give response more than 450 word please, 
               If a user asks about weather, AI image generation, movie or music description, movie or music download, or any question that requires the latest and current information, use the context from the algorithm (Not ChatGPT helper) below the user's message to provide a more comfortable reply. Avoid saying saying you have helper e.g helper: info by google. `
        if (!messages.length)
            messages.push({
                role: 'system',
                content: prompt
            })
        if (messages[0].content !== prompt) messages[0].content = prompt
        messages.push({
            role: 'user',
            content: `UTC: ${currentUTCTime} \nUserinfo: ${M.pushName || 'User'} \nMessage: ${context.trim()} ${helper}`
        })
        const response = await ai.createChatCompletion({
            model: 'gpt-3.5-turbo-16k',
            messages,
            max_tokens: 2500
        })
        const res = response.data.choices[0]?.message
        if (!res) return void M.reply('An error occurred')
        messages.push(res)
        const mix = 5
        if (messages.length >= mix) messages.splice(1, messages.length - mix)
        await client.messagesMap.set(M.from, messages)
        helper = ''
        const text = res.content.replace(new RegExp(`^${client.name}: `), '')
        if (voice == 'true') {
            const audio = await createSpeech(client, emojis(text))
            if (Buffer.isBuffer(audio)) {
                await M.status('recording')
                return void (await client.sendMessage(M.from, { audio }, { quoted: M }))
            }
        } else {
            await M.status('composing')
            return void M.reply(text)
        }
    } catch (error) {
        console.log(error.message)
        return void (await M.reply(
            error?.response?.data?.error?.message ?? 'An error occurred while processing the request.'
        ))
    }
}
