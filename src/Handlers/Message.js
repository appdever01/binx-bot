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
const { Keys, complement } = require("../lib/Messages");
const { serialize, decodeJid } = require("../lib/WAclient");
const { getStats } = require("../lib/stats");
const { Configuration, OpenAIApi } = require("openai");
const { audioToSlice, audioMerge } = require("audio-slicer");
const emojis = require("emoji-strip");
const chalk = require("chalk");
const currentUTCTime = new Date().toUTCString();
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
    let result = await ChatGPTHelper(client.apiKey, body);
    if (!/^{\s*".*"\s*}$/.test(result)) result = '{ "normal": null }';
    const type = JSON.parse(result);
    if (Keys.includes(M.type) && type.dosticker !="true") {
      const message = complement(M.type);
      return void M.reply(message);
    }
    if (type.google) {
      helper = await google(type.google);
      await M.reply("👨🏻‍💻🔎🌐");
    } else if (type.time) {
      helper = await countryTime(type.time);
      await M.reply("👨🏻‍💻⏰⌚️");
    } else if (type.weather) {
      helper = await weather(type.weather);
      await M.reply("👨🏻‍💻🔎☀️🌡");
    } else if (type.wikipedia) {
      helper = await wikipedia(type.wikipedia);
      await M.reply("👨🏻‍💻🔎📚");
    } else if (type.voice) {
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
        const apiUrl = `https://timeless.cyclic.app/api/image/imagine?prompt=${type.imaginesearch}`; 
        
        try {
            const response = await axios.get(apiUrl);
            const imageData = response.data.data; // Get all the image data
            
            if (imageData && imageData.length >= 2) {
                const imageUrl1 = imageData[0].imageUrl;
                const imageUrl2 = imageData[1].imageUrl;
                
                await client.sendMessage(M.from, {
                    image: {
                        url: imageUrl1
                    },
                    caption: 'Imagination brought to life by Binx! 😌💙🔥'
                });
                
                await client.sendMessage(M.from, {
                    image: {
                        url: imageUrl2
                    },
                    caption: 'Another imagination brought to life by Binx! 😌💙🔥'
                });
            } else {
                return M.reply('Could not generate enough images based on the provided prompt.');
            }
        } catch (error) {
            console.error('Error fetching images:', error);
            return M.reply('Could not generate images based on the provided prompt.');
        }
        return true;

    } else if (type.dosticker) {
      
    if (!M.messageTypes(M.type) && !M.messageTypes(M.quoted.mtype))
      return void M.reply("Caption/Quote an image/video/gif message");
    const pack = arg.split("|");
    const buffer = M.quoted ? await M.quoted.download() : await M.download();
    const sticker = await new Sticker(buffer, {
      pack: pack[1]?.trim() || "Crafted by",
      author: pack[2]?.trim() || "Binx AI 🔥",
      categories: ["🤩", "🎉"],
      quality: 70,
      type:
        flag.includes("--c") || flag.includes("--crop")
          ? "crop"
          : flag.includes("--s") || flag.includes("--stretch")
          ? "default"
          : flag.includes("--circle")
          ? "circle"
          : "full",
    }).build();
    await client.sendMessage(M.from, { sticker }, { quoted: M });
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
      return void M.reply("👨🏻‍💻🔎🚀");
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
    const prompt = `You are Binx Ai, a personal friendly WhatsApp AI Bot developed by Tekcify 💜😌 (not only text base), your goal is to have engaging and mutual conversations with humans (Note: u are not only text-based Ai). Use emojis and curious expressions to maintain a friendly conversation. You can listen to voicenote,  reply in voicenote, generate ai images , send images, search for video and musics, search for songs lyrics, and find weather info of places (which are your new features,ur ability to read img/video is coming in next upgrade). If user ask for voice note, just say alright. Always reply with emoji, and !sticker command can be use to convert image to sticker, the prefix ! is important for commands. You are not related to OpenAI or GPT, and users can contact or make feedback Tekcify on IG @tekcify or their web tekcify.com (note: users get 10 free responses per day. redirect them to tekcify.com for more info if they wan to subscribe for premium),(note: u cant turn image to ai image), 
                Incase you don't know how to answer user question or user ask you to write something you can get context from your helper down below user message and make more comfortable reply e.g helper: info by google. `;
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
