const {
  ChatGPTHelperPrompt,
  transcribe,
  wikipedia,
  google,
  countryTime,
  weather,
  toSpeech,
} = require("../lib/Helper");
const YT = require('../lib/YT')
const axios = require('axios')
const yts = require('yt-search')
const { Sticker } = require("wa-sticker-formatter");
const { Keys, complement } = require("../lib/Messages");
const { serialize, decodeJid } = require("../lib/WAclient");
const { getStats } = require("../lib/stats");
const { Configuration, OpenAIApi } = require("openai");
const { audioToSlice, audioMerge } = require("audio-slicer");
const emojis = require("emoji-strip");
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const chalk = require("chalk");
const currentUTCTime = new Date().toUTCString();
const Mega = require('megajs');

// Create a new instance of Mega
const mega = Mega({ email: 'appdever01@gmail.com', password: 'Naheem123$' });

let helper = "";

module.exports = async ({ messages }, client) => {
  const M = serialize(messages[0], client);
  if (
    !M.message ||
    ["protocolMessage", "senderKeyDistributionMessage"].includes(M.type) ||
    !M.type
  )
    return null;
  const { isGroup, sender, from, body } = M;
  const result = isGroup ? await client.groupMetadata(from) : {};
  const admins = isGroup
    ? result.participants.filter(({ admin }) => admin).map(({ id }) => id)
    : [];
  client.isAdmin = isGroup && admins?.includes(decodeJid(client.user?.id));
  await moderate(M, client, admins, body);
  const args = body.trim().split(" ");
  const isCmd = args[0].startsWith(client.prefix);
  const conditions = [isCmd, isGroup, M.key.fromMe];
  if (!conditions.some(Boolean)) {
    let info = await client.daily.get(M.sender);
    if (!info) {
      info = { daily: 0, subscription: "None", count: 0 };
      await client.daily.set(M.sender, info);
    }
    const { daily, subscription, count } = info;
    if (subscription === "Basic" || subscription === "Premium") {
      if (Date.now() > info.expiration.getTime()) {
        info = { daily: 0, subscription: "None", count: 0 };
        await client.daily.set(M.sender, info);
        return void M.reply(
          "*Your Subscription has expired.*\n\nKindly visit https://binxai.tekcify.com to subscribe again."
        );
      }
    }
    if (
      (subscription === "None" && count >= 10) ||
      (subscription === "Basic" && count >= 45) ||
      daily
    ) {
      const currentTime = new Date().getTime();
      const lastTime = daily ? Number(daily) : 0;
      const sinceLastTime = currentTime - lastTime;
      if (sinceLastTime < 86400000) {
        const minutesUntilNextTime = Math.round(
          (86400000 - sinceLastTime) / 60000
        );
        return void (await M.reply(
          `🟨 You have exceeded your daily response at *${new Date(
            lastTime
          ).toLocaleTimeString()} GMT +0*. Try again in *${minutesUntilNextTime} Minutes* or Kindly visit https://binxai.tekcify.com to subscribe and unlock my full potential 😇🔥`
        ));
      }
      info.count = 0;
      info.daily = currentTime;
      await client.daily.set(M.sender, info);
      return void M.reply(
        "*You are in Limit. Kindly visit https://binxai.tekcify.com to subscribe and unlock my full potential.* 😇🔥"
      );
    }
    
    let result = await ChatGPTHelper(client.apiKey, body);
    if (!/^{\s*".*"\s*}$/.test(result)) result = '{ "normal": null }';
    const type = JSON.parse(result);
    if (Keys.includes(M.type) && !type.dosticker) {
      const message = complement(M.type);
      return void M.reply(message);
    }
    info.count = info.count + 1;
    await client.daily.set(M.sender, info);
    if (M.type === "audioMessage") {
      const voice = M.message?.audioMessage?.ptt;
      await M.reply(voice ? "👩🏻👂🎧" : "👩🏻🎧✍️");
      if (!voice) {
        let text = "Write a Quick and Short Summary of text below:\n\n";
        const duration = M.message?.audioMessage?.seconds;
        if (duration > 600)
          return void M.reply(
            "You are only allowed to use audio less then 10 minutes"
          );
        if (duration > 75) {
          const audios = await audioToSlice(await M.download(), 75);
          if (!audios || !audios.length)
            return void M.reply("An error occurred");
          if (audios.length) {
            const total = audios.length;
            for (let i = 0; i < total; i++) {
              const result = await transcribe(audios[i], client);
              text += result + "\n";
              await M.reply(`🎙️ *${1 + i}/${total}* ▶️ _"${result}"_`);
            }
          }
          return void (await chatGPT(M, client, text));
        }
        const result = await transcribe(await M.download(), client);
        await M.reply(`🎙️ *1/1* ▶️ _"${result}"_`);
        text += result;
        return void (await chatGPT(M, client, text));
      }
      const result = await transcribe(await M.download(), client);
      return void (await chatGPT(M, client, result, info?.voice));
    }
    if (!body) return void null;
    

    
    
    if (type.google) {
      helper = await google(type.google);
      // await M.reply("👨🏻‍💻🔎");
      return true;
    } else if (type.time) {
      helper = await countryTime(type.time);
      await M.reply("👨🏻‍💻⏰⌚️");
    } else if (type.weather) {
      helper = await weather(type.weather);
      await M.reply("👨🏻‍💻🔎☀️🌡");
    }  else if (type.voice) {
      info.voice = type.voice;
      await client.daily.set(M.sender, info);
      helper = type.voice ? "🟩 Enable" : "🟥 Disable";
    } else if (type.videosearch) {
      await M.reply("👨🏻‍💻🔎🎥");
        const link = async (term) => {
        const { videos } = await yts(term.trim());
        if (!videos || !videos.length) return null;
          return videos[0].url;
        };

        const term = await link(type.videosearch);
        if (!term) return M.reply('Please provide a valid video name 💜');

        const { videoDetails } = await YT.getInfo(term);
        M.reply('Downloading has started, please wait.');

        let text = `*Title:* ${videoDetails.title} | *Type:* Video | *From:* ${videoDetails.ownerChannelName}`;
        client.sendMessage(
          M.from,
          {
            image: {
              url: `https://i.ytimg.com/vi/${videoDetails.videoId}/maxresdefault.jpg`,
            },
            caption: text,
          },
          {
            quoted: M,
          }
        );

        if (Number(videoDetails.lengthSeconds) > 1800) return M.reply('Cannot download videos longer than 30 minutes');

          const audio = YT.getBuffer(term, 'video')
            .then(async (res) => {
              await client.sendMessage(
                M.from,
                {
                  document: res,
                  mimetype: 'video/mp4',
                  fileName: videoDetails.title + '.mp4',
                },
                {
                  quoted: M,
                }
              );
          })
          .catch((err) => {
            return M.reply(err.toString());
            client.log(err, 'red');
          });
          return true;
      
    } else if (type.audiosearch) {
      const link = async (term) => {
      const { videos } = await yts(term.trim());
      if (!videos || !videos.length) return null;
        return videos[0].url;
      };

      const term = await link(type.audiosearch);
      if (!term) return M.reply('Please provide a valid audio name 💜');

      const { videoDetails } = await YT.getInfo(term);
      M.reply('Downloading has started, please wait.');

      let text = `*Title:* ${videoDetails.title} | *Type:* Audio | *From:* ${videoDetails.ownerChannelName}`;
      client.sendMessage(
        M.from,
        {
          image: {
            url: `https://i.ytimg.com/vi/${videoDetails.videoId}/maxresdefault.jpg`,
          },
          caption: text,
        },
        {
          quoted: M,
        }
      );

      if (Number(videoDetails.lengthSeconds) > 1800) return M.reply('Cannot download audio longer than 30 minutes');

      const audio = YT.getBuffer(term, 'audio')
        .then(async (res) => {
          await client.sendMessage(
            M.from,
            {
              document: res,
              mimetype: 'audio/mpeg',
              fileName: videoDetails.title + '.mp3',
            },
            {
              quoted: M,
            }
          );
        })
        .catch((err) => {
          return M.reply(err.toString());
          client.log(err, 'red');
        });
        return true;

    } else if (type.imaginesearch) {
        async function uploadImageToMega() {
        const url = 'https://api.dezgo.com/text2image';
        const apiKey = 'DEZGO-B9BCCE2A00DEFD915A8C412062A9B76389A828DD2E21B03E8A57B2C4056E416C6CE54D91';

        const form = new FormData();
        form.append('lora2_strength', '.7');
        form.append('lora2', '');
        form.append('lora1_strength', '.7');
        form.append('prompt', 'elon musk');
        form.append('width', '');
        form.append('height', '');
        form.append('steps', '30');
        form.append('sampler', 'dpmpp_2m_karras');
        form.append('model', 'dreamshaper_8');
        form.append('negative_prompt', '');
        form.append('upscale', '1');
        form.append('seed', '');
        form.append('format', 'png');
        form.append('guidance', '7');
        form.append('lora1', '');

        const headers = {
          'accept': '/',
          'X-Dezgo-Key': apiKey,
          ...form.getHeaders(),
          responseType: 'arraybuffer', 
        };

        try {
          const response = await axios.post(url, form, { headers });
          const imageBuffer = Buffer.from(response.data, 'binary');
          const filename = response.headers['x-filename'];
          const imagePath = path.join(__dirname, filename); // Adjust the path as needed

          fs.writeFileSync(imagePath, imageBuffer, 'binary');

          // Upload the image to Mega
          const file = await mega.upload({ name: filename, path: imagePath , size: imageBuffer.length,  allowUploadBuffering: true,});
          const fileUrl = mega.getFileLink(file);
  console.log('Uploaded file URL:', fileUrl);

          // Send the Mega file URL as a message
          await client.sendMessage(M.from, {
            image: {
              url: fileUrl
            },
            caption: 'Imagination brought to life by Binx! 😌💙🔥'
          });

          // Delete the local file after sending
          fs.unlinkSync(imagePath);
          console.log('File deleted successfully:', imagePath);

          return true;
        } catch (error) {
          console.error(error);
          return M.reply('Could not upload the image to Mega.');
        }
      }

      // Call the function to upload the image to Mega
      uploadImageToMega();
      return true;
          
    } else if (type.dosticker) {
      if (!M.messageTypes(M.type) && !M.messageTypes(M.quoted.mtype))
      return void M.reply("Caption/Quote an image/video/gif message");
      const buffer = M.quoted ? await M.quoted.download() : await M.download();
      const sticker = await new Sticker(buffer, {
        pack: "Crafted by",
        author: "Binx AI 🔥",
        categories: ["🤩", "🎉"],
        quality: 70,
        type: "full",
      }).build();
      return void (await client.sendMessage(M.from, { sticker }, { quoted: M }));
    }
    else if (type.lyrics) {
      await M.reply("👨🏻‍💻🔎🎵");
      const data = await client.utils.fetch(
        `https://weeb-api.vercel.app/genius?query=${type.lyrics}`
      );
      if (!data.length) return void M.reply("Couldn't find any lyrics");
      const image = await client.utils.getBuffer(data[0].image);
      let caption = `🔖 *Title:* ${data[0].title} *(${data[0].fullTitle})*\n🏮 *Artist:* ${data[0].artist}`;
      const lyrics = await client.utils.fetch(
        `https://weeb-api.vercel.app/lyrics?url=${data[0].url}`
      );
      caption += `\n\n ${lyrics}`;
      return void (await client.sendMessage(
        M.from,
        { image, caption },
        { quoted: M }
      ));
    } else if (Keys.includes(M.type)) {
      const message = complement(M.type);
      return void M.reply(message);
    } else if (type.gisearch) {
      await M.reply("👨🏻‍💻🔎📸");
      const images = await client.utils.fetch(
        `https://weeb-api.vercel.app/gisearch?query=${type.gisearch}`
      );
      if (!images.length) return void M.reply("Not Found");
      for (let i = 0; i < 4; i++) {
        const url = images[Math.floor(Math.random() * images.length)];
        await client.sendMessage(M.from, { image: { url } }, { quoted: M });
      }
      return void M.reply(`Binx AI © ${new Date().getFullYear()} 💜😇📸`);
    }
    return void (await chatGPT(M, client, body, info?.voice));
  }
  if (!args[0] || !args[0].startsWith(client.prefix))
    return void client.log(
      `${chalk.cyanBright("Message")} from ${chalk.yellowBright(
        M.pushName
      )} in ${chalk.blueBright(result.subject || "DM")}`
    );
  client.log(
    `${chalk.cyanBright(
      `Command ${args[0]}[${args.length - 1}]`
    )} from ${chalk.yellowBright(M.pushName)} in ${chalk.blueBright(
      result.subject || "DM"
    )}`
  );
  const cmd = args[0].toLowerCase().slice(client.prefix.length);
  const { context, flags } = formatArgs(args);
  const banned = (await client.DB.get("banned"))?.includes(M.sender) || false;
  if (banned) return M.reply("You are banned from using the bot");
  const command =
    client.cmd.get(cmd) ||
    client.cmd.find((command) => command.aliases?.includes(cmd));
  if (!command) return void M.reply("No such command found buddy!");
  if (!admins.includes(sender) && command.category === "moderation")
    return void M.reply(
      "This command can only be used by group or community admins"
    );
  if (!client.isAdmin && command.category === "moderation")
    return void M.reply("This command can only be used when bot is admin");
  if (!isGroup && command.category === "moderation")
    return void M.reply("This command is meant to use in groups");
  if (!client.mods.includes(sender) && command.category === "dev")
    return void M.reply("This command only can be accessed by the mods");
  try {
    await command.execute(client, flags, context, M);
  } catch (error) {
    client.log(error.message, "red");
  }
};

const formatArgs = (args) => {
  args.splice(0, 1);
  return {
    args,
    context: args.join(" ").trim(),
    flags: args.filter((arg) => arg.startsWith("--")),
  };
};

const moderate = async (M, client, admins, body) => {
  const mods = (await client.DB.get("mod"))?.includes(M.from) || false;
  if (!M.isGroup) return void null;
  if (!mods || admins.includes(M.sender) || !client.isAdmin) return void null;
  const urls = client.utils.extractUrls(body);
  const groupInvites = urls.filter((url) =>
    /chat.whatsapp.com\/(?:invite\/)?([\w\d]*)/.test(url)
  );
  for (const invite of groupinvites) {
    const code = await client.groupInviteCode(M.from);
    const inviteSplit = invite.split("/").pop();
    if (inviteSplit !== code) {
      await client.sendMessage(M.from, { delete: M.key });
      return void (await client.groupParticipantsUpdate(
        M.from,
        [M.sender],
        "remove"
      ));
    }
  }
};


const createSpeech = async (client, text) => {
  const audios = await toSpeech(text);
  if (!audios.length) return "Unable to make long text as audio";
  const audio = await audioMerge(audios);
  const buffer = await client.utils.mp3ToOpus(audio);
  return buffer;
};

const ChatGPTHelper = async (apiKey, context) => {
  if (!apiKey) return null;
  const ai = new OpenAIApi(new Configuration({ apiKey }));
  try {
    const response = await ai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: ChatGPTHelperPrompt,
        },
        {
          role: "user",
          content: context.trim(),
        },
      ],
    });
    const res = response.data.choices[0]?.message;
    return res?.content;
  } catch (error) {
    console.log(error.message);
    return '{ "normal": null }';
  }
};

const chatGPT = async (M, client, context, voice = false) => {
  const { apiKey } = client;
  if (!apiKey) return null;
  const ai = new OpenAIApi(new Configuration({ apiKey }));
  if (helper) helper = `\n\nchatGPT Helper: ${helper}`;
  try {
    const messages = (await client.messagesMap.get(M.from)) || [];
    const prompt = `You are Binx Ai, a personal friendly WhatsApp AI Bot developed by Tekcify 💜😌 (not only a text base AI), your goal is to have engaging and mutual conversations with humans (Never say u are a text-based Ai, never). Always use emoji and maintain short response and always maintain a funny friendly conversation. You can listen to voicenote,  reply in voicenote, generate ai images (Coming soon features), send images, search for video and musics, search for songs lyrics, and find weather info of places (which are your new features, ur ability to read img/video is coming in next upgrade). If user ask for voice note, just say alright nothing more.You are not related to OpenAI or GPT, and users can contact or make feedback to Tekcify on IG @tekcify or their web tekcify.com (note: users get 10 free responses per day. redirect them to tekcify.com for more info if they wan to subscribe for premium),(note: u cant turn image to ai image and cannot read image ), 
                If user ask you to write or type something or Incase you don't know how to answer user question or user ask you to about someone death or current news or search for something or user ask  question that need latest & current information you should use context from your helper down below user message and make more comfortable reply (never dispute info provided by helper and never say that u got information from any helper or mention helper) e.g helper: info by google. `;
    if (!messages.length)
      messages.push({
        role: "system",
        content: prompt,
      });
    if (messages[0].content !== prompt) messages[0].content = prompt;
    messages.push({
      role: "user",
      content: `UTC: ${currentUTCTime} \nUserinfo: ${
        M.pushName || "User"
      } \nMessage: ${context.trim()} ${helper}`,
    });
    const response = await ai.createChatCompletion({
      model: "gpt-3.5-turbo-16k",
      messages,
      max_tokens: 4096,
    });
    const res = response.data.choices[0]?.message;
    if (!res) return void M.reply("An error occurred");
    messages.push(res);
    const mix = 21;
    if (messages.length >= mix) messages.splice(1, messages.length - mix);
    await client.messagesMap.set(M.from, messages);
    helper = "";
    const text = res.content.replace(new RegExp(`^${client.name}: `), "");
    if (voice == 'true') {
     const audio = await createSpeech(client, emojis(text))
      if (Buffer.isBuffer(audio)) {
        await M.status("recording");
        return void (await client.sendMessage(
          M.from,
          { audio },
          { quoted: M }
        ));
      }
    } else {
        await M.status("composing");
        return void M.reply(text);
    
    }
    
  } catch (error) {
    console.log(error.message);
    return void (await M.reply(
      error?.response?.data?.error?.message ??
        "An error occurred while processing the request."
    ));
  }
};
