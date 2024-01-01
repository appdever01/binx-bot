require("dotenv").config();
const {
  default: Baileys,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const { QuickDB } = require("quick.db");
const { MongoDriver } = require("quickmongo");
const { Collection } = require("discord.js");
const MessageHandler = require("./Handlers/Message");
const EventsHandler = require("./Handlers/Events");
const contact = require("./lib/contacts");
const utils = require("./lib/function");
const express = require("express");
const chalk = require("chalk");
const cors = require("cors");
const P = require("pino");
const { Boom } = require("@hapi/boom");
const { join } = require("path");
const { imageSync } = require("qr-image");
const { readdirSync, remove } = require("fs-extra");
const verification = new Map();
const app = express();
app.use(express.json());
app.use(cors());

const port = process.env.PORT || 3000;
const driver = new MongoDriver(process.env.URL);

const start = async () => {
  const { state, saveCreds } = await useMultiFileAuthState("session");
  const client = Baileys({
    version: (await fetchLatestBaileysVersion()).version,
    auth: state,
    logger: P({ level: "silent" }),
    browser: ["Binx-ChatGPT", "silent", "4.0.0"],
    printQRInTerminal: true,
  });

  client.name = process.env.NAME || "Binx";
  client.prefix = process.env.PREFIX || "!";
  const apiKey1 = process.env.OPENAI_KEY1 || "";
  const apiKey2 = process.env.OPENAI_KEY2 || "";

  // Randomly select one of the API keys
  const randomApiKey = Math.random() < 0.5 ? apiKey1 : apiKey2;

  client.apiKey = randomApiKey;
  client.mods = (process.env.MODS || "2347049972537")
    .split(", ")
    .map((jid) => `${jid}@s.whatsapp.net`);

  client.DB = new QuickDB({ driver });
  client.messagesMap = client.DB.table("messages");
  client.contactDB = client.DB.table("contacts");
  client.exp = client.DB.table("experience");
  client.daily = client.DB.table("daily");
  client.cmd = new Collection();
  client.contact = contact;
  client.utils = utils;

  /**
   * @param {string}
   */

  client.makeWaJid = (str) =>
    (/\d/.test(str) ? str.replace(/\D/g, "") : 123) + "@s.whatsapp.net";

  /**
   * @param {string} phone
   * @returns {boolean}
   */

  client.isWaNumber = async (phone) =>
    (await client.onWhatsApp(phone))[0]?.exists || false;

  /**
   * @returns {Promise<string[]>}
   */

  client.getAllGroups = async () =>
    Object.keys(await client.groupFetchAllParticipating());

  /**
   * @returns {Promise<string[]>}
   */

  client.getAllUsers = async () => {
    const data = (await client.contactDB.all()).map((x) => x.id);
    const users = data
      .filter((element) => /^\d+@s$/.test(element))
      .map((element) => `${element}.whatsapp.net`);
    return users;
  };

  client.log = (text, color = "green") =>
    color
      ? console.log(chalk.keyword(color)(text))
      : console.log(chalk.green(text));

  const loadCommands = async () => {
    const readCommand = (rootDir) => {
      readdirSync(rootDir).forEach(($dir) => {
        const commandFiles = readdirSync(join(rootDir, $dir)).filter((file) =>
          file.endsWith(".js")
        );
        for (let file of commandFiles) {
          const command = require(join(rootDir, $dir, file));
          client.cmd.set(command.name, command);
          client.log(`Loaded: ${command.name.toUpperCase()} from ${file}`);
        }
      });
      client.log("Successfully Loaded Commands");
    };
    readCommand(join(__dirname, ".", "Commands"));
  };

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;
    if (update.qr) {
      client.log(`[${chalk.red("!")}]`, "white");
      client.log(
        `Scan the QR code above | You can also authenicate in http://localhost:${port}`,
        "blue"
      );
      client.QR = imageSync(update.qr);
    }
    if (connection === "close") {
      const { statusCode } = new Boom(lastDisconnect?.error).output;
      if (statusCode !== DisconnectReason.loggedOut) {
        console.log("Connecting...");
        setTimeout(() => start(), 3000);
      } else {
        client.log("Disconnected.", "red");
        await remove("session");
        console.log("Starting...");
        setTimeout(() => start(), 3000);
      }
    }
    if (connection === "connecting") {
      client.state = "connecting";
      console.log("Connecting to WhatsApp...");
    }
    if (connection === "open") {
      client.state = "open";
      loadCommands();
      client.log("Connected to WhatsApp");
    }
  });

  app.get("/", (req, res) =>
    res.status(200).setHeader("Content-Type", "image/png").send(client.QR)
  );

  app.all("/request", async (req, res) => {
    const { phone } = req.method === "GET" ? req.query : req.body;
    if (!phone) return void res.sendStatus(404);
    const jid = client.makeWaJid(phone);
    const valid = await client.isWaNumber(jid);
    if (!valid)
      return void res
        .status(404)
        .json({ failed: "Number not available on WhatsApp" });
    if (verification.has(jid)) {
      const storedCode = verification.get(jid);
      const remainingTime = client.utils.convertMs(
        storedCode.expiration - Date.now()
      );
      return void res
        .status(200)
        .json({ cooldown: `Please wait for ${remainingTime} seconds` });
    }
    const code = Math.floor(100000 + Math.random() * 900000);
    verification.set(jid, { code, expiration: Date.now() + 120000 });
    await client.sendMessage(jid, {
      text: `Your OTP is ${code} \n\nBinx AI © ${new Date().getFullYear()}`,
    });
    setTimeout(() => verification.delete(jid), 120000);
    return void res.status(200).json({ successful: "Open Your WhatsApp!" });
  });

  app.all("/verify", async (req, res) => {
    const { phone, code, subscription } =
      req.method === "GET" ? req.query : req.body;
    if (![phone, code, subscription].some(Boolean))
      return void res.sendStatus(404);
    if (!["Basic", "Premium"].includes(subscription))
      return res.status(404).json({ failed: "Invaild Subscription" });
    const otp = parseInt(code);
    const jid = client.makeWaJid(phone);
    const valid = await client.isWaNumber(jid);
    if (!valid)
      return void res
        .status(404)
        .json({ failed: "Number not available on WhatsApp" });
    const storedCode = verification.get(jid);
    if (
      !storedCode ||
      Date.now() > storedCode?.expiration ||
      otp !== storedCode?.code
    )
      return void res.status(400).json({ failed: "Invalid or Expired Code" });
    const info = {
      daily: 0,
      subscription,
      count: 0,
      expiration: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
    await client.daily.set(jid, info);
    const successful = `Congratulations 🎉🎊. You are now registered as a ${subscription} user 🥹😇`;
    await client.sendMessage(jid, { text: "" + successful, mentions: [jid] });
    return void res.json({ successful });
  });

  app.use('/images', express.static('/root/binx-bot/src/Handlers'));


  client.ev.on(
    "messages.upsert",
    async (messages) => await MessageHandler(messages, client)
  );

  client.ev.on(
    "group-participants.update",
    async (event) => await EventsHandler(event, client)
  );

  client.ev.on(
    "contacts.update",
    async (update) => await contact.saveContacts(update, client)
  );

  client.ev.on("creds.update", saveCreds);
  return client;
};

if (!process.env.URL)
  return console.error("You have not provided any MongoDB URL!!");
driver
  .connect()
  .then(() => {
    console.log(`Connected to the database!`);
    start();
  })
  .catch((err) => console.error(err));

app.listen(port, () => console.log(`Server started on PORT : ${port}`));
