const axios = require("axios").default;
const FormData = require("form-data");
const googleit = require("google-it");
const googleTTS = require("google-tts-api");
const { search, summary } = require("wikipedia");
const { tmpdir } = require("os");
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const fs = require("fs-extra");
const path = require("path");

const ChatGPTHelperPrompt = `analysis up coming messages, remember You have 8 features (current time, google search, latest news, movie search, weather, voicenote response, write/text response ,send video, send audio, do sticker), so when a message is about that you need to extract it
e.g:
To Get current time & date info of (Country/City),
Q: Can you tell current time of Pakistan?
Note: it'll take country/city
return { "time": "Pakistan" }

To reply in text or disable voicemode or stop talking or want to exist voicemode or write ...,
Q: reply me in text or exist voicemode or help me write something 
return { "voice": "false" }

if user say 'write something' or 'type' return { "voice": "false" },
e.g Q: help me write pickup line or write about nigeria or give me written response or reply in text
return { "voice": "false" }

To reply in voicenote or enable voice reply or talk in voice,
Q: reply using voicenote or use voice to reply me or reply in male/female voice or talk / speak to me
return { "voice": "true" }

To Get information related to weather,
Q: Can you tell info about today weather in Lahore?
Note: it'll take country/city
return { "weather": "Lahore" }

To Get movie, song, album, artist or music information , not lyrics o, just movie or music information
Q: Do you know hidden strike movie 2023 or who sang Ask about me
return { "google": "Hidden strike movie | ask about me artist" }

if user ask To download movie or send video or mp4 not details of movie not if they ask if you know a movie o
Q: send me video of davido feel music or download movie 
return { "videosearch": "Davido feel video"}

If user as To download music or send music/audio or send song not if they ask if you know a musci o
Q: send me audio/song of davido feel or davido music 
return { "audiosearch": "feel by Davido"}

To turn/convert image to sticker
Q: turn this image to sicker
return { "dosticker": "true"}

To Get upto date latest information, news or deep information about someones death, personality, person, queen, current president , players etc
Q: Who is the current president of nigeria
return { "google": "current president of Nigeria 2024" }


To get lyrics of any song with artist name,
Q: Can you give the lyrics of Amapiano by asake?
Return: { "lyrics": "Amapiano by asake" }

To generate AI image or pictures but not self ai image 
Q: help me generate ai image of elon musk or convert to ai image 
return: { "imaginesearch": "elon musk" }

To to image or pictures to ai
Q: turn my image or picture to ai, make the image wear hat
return: { "imgtoimg": "make the image to wear hat" }

To get any kind of wallpaper, pictures or image, if (NSWF) return "NO"
Q: Can you send me a picture, image or wallpaper or diagram? 
return: { "gisearch": "image name or diagram name" }

For normal discussion topics related to chatting:
Incase, it's a simple message like: "hi", "dm", "well", "weeb", or anything else
return { "normal": null }`;


const toSpeech = (text) =>
  googleTTS
    .getAllAudioBase64(text, {
      lang: 'en',
      slow: false,
      host: "https://translate.google.com",
      timeout: 10000,
      splitPunct: ",.?",
    })
    .then((results) => {
      const buffers = results.map(({ base64 }) =>
        Buffer.from(base64, "base64")
      );
      return buffers;
    })
    .catch((error) => {
      console.error(error.message);
      return [];
    });

const fetch = async (url) => (await axios.get(url)).data;

const transcribe = async (buffer, client) => {
  const from = new FormData();
  from.append("file", buffer, {
    filename: "audio.mp3",
    contentType: "audio/mp3",
  });
  from.append("model", "whisper-1");
  const headers = {
    Authorization: `Bearer ${client.apiKey}`,
    ...from.getHeaders(),
  };
  try {
    const {
      data: { text },
    } = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      from,
      { headers }
    );
    return text;
  } catch (error) {
    console.log(error.message);
    return "Oops! Unfortunately, something did not go as expected.";
  }
};

const wikipedia = async (query) => {
  const { results } = await search(query);
  if (!results.length) return "Cannot find related Info.";
  const result = await summary(results[0].title);
  const { title, description, content_urls, extract } = result;
  const text = `Title: ${title}, Description: ${description}, Summary Info: ${extract}`;
  return text;
};

const google = async (query) => {
  const results = await fetch(
    `https://weeb-api.vercel.app/google?query=${query}`
  );
  let text = "";
  for (let i = 0; i < Math.min(results.length, 10); i++) {
    const { link, snippet, title } = results[i];
    text += `Title: ${title}, Snippet: ${snippet}\n`;
  }
  return text;
};

const countryTime = async (query) => {
  const result = await fetch(
    `https://weeb-api.vercel.app/timeinfo?query=${query}&key=Baka`
  );
  if (result.error) return `Couldn't find Country/City as ${query}`;
  const text = `Location: ${query} \nCurrent Time: ${result.currentTime}, Current Date: ${result.currentDate}\n`;
  return text;
};

const weather = async (query) => {
  try {
    const results = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${query}&units=metric&appid=e409825a497a0c894d2dd975542234b0&language=tr`
    );
    if (results.message) return `Couldn't find Country/City as ${query}`;
    const { sys, name, main, wind, clouds } = results;
    const sunrise = new Date(sys.sunrise * 1000).toLocaleTimeString();
    const sunset = new Date(sys.sunset * 1000).toLocaleTimeString();
    const weatherDescription = results.weather[0].description;
    const text = `
Country: ${sys.country}, Location: ${name}
Temperature: ${main.temp}°C, Feels Like: ${main.feels_like}°C
Min Temperature: ${main.temp_min}°C, Max Temperature: ${main.temp_max}°C
Pressure: ${main.pressure} hPa, Humidity: ${main.humidity}%
Wind Speed: ${wind.speed} km/h, Clouds: ${clouds.all}%
Sunrise: ${sunrise}, Sunset: ${sunset}
Weather Description: ${weatherDescription}
`;
    return text;
  } catch (error) {
    console.error(error.message);
    return "Unable To Find Country/City";
  }
};



module.exports = {
  ChatGPTHelperPrompt,
  toSpeech,
  fetch,
  transcribe,
  wikipedia,
  google,
  countryTime,
  weather,
};
