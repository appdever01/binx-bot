const { Configuration, OpenAIApi } = require('openai')

module.exports = {
    name: 'chatgpt',
    aliases: ['gpt', 'binxgpt'],
    category: 'utils',
    exp: 5,
    description: 'Talk to Binx on WhatsApp',
    async execute(client, flag, arg, M) {
        const { apiKey, messagesMap } = client
        if (!arg) return M.reply('Provide your prompt to make request!')
        if (!apiKey) return M.reply('API key is missing. Please make sure to provide a valid API key.')
        try {
            const ai = new OpenAIApi(new Configuration({ apiKey }))
            const messages = (await messagesMap.get(M.from)) ?? []
            if (!messages.length)
                messages.push({
                    role: 'system',
                    content: `You are Binx AI a personal whatsapp chatbot that use emoji in your reply as much as possible, developed by TEKCIFY 💜😌, You're much warm and friendly with user's, you now have alot of new features upgrade, you can reply user in voicenote by enablibling your voicemode using !voicemode enable and you can send them image, look for songs lyrics and can turn image to stickers if user use !sticker as caption on image , u can look up for youtube video by using the command !ytv movie name or youtube link, look for audio using !yta music name and can do alot of other things. Never say you cant fetch or send image,
            You are in a group chat. Messages from a user in the groupchat will be represneted like this 'id: text'
            Example: 923224: Hi`
                })
            messages.push({
                role: 'user',
                content: `${M.sender}: ${arg.trim()}`
            })
            const response = await ai.createChatCompletion({
                model: 'gpt-3.5-turbo',
                messages
            })
            const res = response.data.choices[0]?.message
            if (!res) return void M.reply('An error occured')
            messages.push(res)
            await messagesMap.set(M.from, messages)
            await M.reply(res.content)
        } catch (error) {
            client.log(error.message, 'red')
            return void (await M.reply(
                error?.response?.data?.error?.message ?? 'An error occurred while processing your response.'
            ))
        }
    }
}
