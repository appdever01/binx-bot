const axios = require('axios').default
const FormData = require('form-data')
const googleit = require('google-it')
const googleTTS = require('google-tts-api')
const { search, summary } = require('wikipedia')
const { tmpdir } = require('os')
const { promisify } = require('util')
const exec = promisify(require('child_process').exec)
const fs = require('fs-extra')
const path = require('path')

const ChatGPTHelperPrompt = `analysis up coming messages, remember You have 4 features (current time, google search, weather, wikipedia details), so when a message is about that you need to extract it
e.g:
To Get current time & date info of (Country/City),
Q: Can you tell current time of Pakistan?
Note: it'll take country/city
return { "time": "Pakistan" }

<<<<<<< HEAD
if user say enable/disable voicenote or voicemode then return true if enable else false { "voice": "true" }

=======
>>>>>>> bf95a8394e76212db18262ad27f4eefdee681ff9
To Get information related to weather,
Q: Can you tell info about today weather in Lahore?
Note: it'll take country/city
return { "weather": "Lahore" }

To Get information which you don't know,
Q: Can you tell about current exchange rate between Pakistan and USA?
return { "google": "current exchange rate between Pakistan and USA" }

To get deep details of a word, character, specific personality, person, queen,
Q: Can you give me details of Langchain?
return { "wikipedia": "Langchain" }

To get lyrics of any song with artist name,
Q: Can you give the lyrics of let me down slowly?
Return: { "lyrics": "let me down slowly" }

to get any kind of wallpaper or image, if (NSWF) return "NO"
Q: Can you give the Naruto HD images or wallpaper?
Return: { "gisearch": "Naruto" }

For normal discussion topics related to chatting:
Incase, it's a simple message like: "hi", "dm", "well", "weeb", or anything else
return { "normal": null }`

const toSpeech = (text) =>
    googleTTS
        .getAllAudioBase64(text, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
            splitPunct: ',.?'
        })
        .then((results) => {
            const buffers = results.map(({ base64 }) => Buffer.from(base64, 'base64'))
            return buffers
        })
        .catch((error) => {
            console.error(error.message)
            return []
        })

const fetch = async (url) => (await axios.get(url)).data

const transcribe = async (buffer, client) => {
    const from = new FormData()
    from.append('file', buffer, {
        filename: 'audio.mp3',
        contentType: 'audio/mp3'
    })
    from.append('model', 'whisper-1')
    const headers = {
        Authorization: `Bearer ${client.apiKey}`,
        ...from.getHeaders()
    }
    try {
        const {
            data: { text }
        } = await axios.post('https://api.openai.com/v1/audio/transcriptions', from, { headers })
        return text
    } catch (error) {
        console.log(error.message)
        return 'Oops! Unfortunately, something did not go as expected.'
    }
}

const wikipedia = async (query) => {
    const { results } = await search(query)
    if (!results.length) return 'Cannot find related Info.'
    const result = await summary(results[0].title)
    const { title, description, content_urls, extract } = result
    const text = `Title: ${title}, Description: ${description}, URL: ${content_urls.desktop.page}, Summary Info: ${extract}`
    return text
}

const google = async (query) => {
    const results = await fetch(`https://weeb-api.vercel.app/google?query=${query}`)
    let text = ''
    for (let i = 0; i < Math.min(results.length, 10); i++) {
        const { link, snippet, title } = results[i]
        text += `Title: ${title}, Snippet: ${snippet}, Link: ${link}\n`
    }
    return text
}

const countryTime = async (query) => {
    const result = await fetch(`https://weeb-api.vercel.app/timeinfo?query=${query}&key=Baka`)
    if (result.error) return `Couldn't find Country/City as ${query}`
    const text = `Location: ${query} \nCurrent Time: ${result.currentTime}, Current Date: ${result.currentDate}\n`
    return text
}

const weather = async (query) => {
    try {
        const results = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${query}&units=metric&appid=e409825a497a0c894d2dd975542234b0&language=tr`
        )
        if (results.message) return `Couldn't find Country/City as ${query}`
        const { sys, name, main, wind, clouds } = results
        const sunrise = new Date(sys.sunrise * 1000).toLocaleTimeString()
        const sunset = new Date(sys.sunset * 1000).toLocaleTimeString()
        const weatherDescription = results.weather[0].description
        const text = `
Country: ${sys.country}, Location: ${name}
Temperature: ${main.temp}°C, Feels Like: ${main.feels_like}°C
Min Temperature: ${main.temp_min}°C, Max Temperature: ${main.temp_max}°C
Pressure: ${main.pressure} hPa, Humidity: ${main.humidity}%
Wind Speed: ${wind.speed} km/h, Clouds: ${clouds.all}%
Sunrise: ${sunrise}, Sunset: ${sunset}
Weather Description: ${weatherDescription}
`
        return text
    } catch (error) {
        console.error(error.message)
        return 'Unable To Find Country/City'
    }
}

module.exports = {
    ChatGPTHelperPrompt,
    toSpeech,
    fetch,
    transcribe,
    wikipedia,
    google,
    countryTime,
    weather,
    audioMerge
}
