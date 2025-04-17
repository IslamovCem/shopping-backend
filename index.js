// ✅ CONFIG
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const FormData = require('form-data');
const axios = require('axios');
const productRoutes = require('./routes/productRoutes');

// ✅ APP
const app = express();
const PORT = process.env.PORT || 8080;
app.use(cors());
app.use(express.json());
app.use('/api/products', productRoutes);

// ✅ DATABASE
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB ulandi');
    app.listen(PORT, () => console.log(`🚀 Server ${PORT}-portda ishlamoqda`));
  })
  .catch(err => console.error('❌ Mongo xato:', err));

// ✅ BOT
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("🤖 BOT YUKLANDI");

const BACKEND_URL = process.env.BACKEND_URL;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const BROADCAST_GROUP_ID = -1002693584186;
const adminIds = [1573771417];
let tempImages = {};
let latestProductByAdmin = {};
const activeUsers = new Set();

// ✅ /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const fullName = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();

  if (msg.chat.type === 'private') activeUsers.add(chatId);
  const usersCount = activeUsers.size;

  const keyboard = {
    inline_keyboard: [[{
      text: "🛍 Do‘konni ochish",
      web_app: { url: "https://telegram-miniapp-jade-gamma.vercel.app" }
    }]]
  };

  if (adminIds.includes(userId)) {
    bot.sendMessage(chatId,
      `👋 Salom, Admin ${fullName}!\n📋 Foydalanuvchilar soni: ${usersCount} ta\n📝 Buyruqlar:\n/add — Mahsulot qo‘shish\n/list — Mahsulotlar\n/delete — O‘chirish\n/elon <matn> — Xabar yuborish`,
      { reply_markup: keyboard });
  } else {
    bot.sendMessage(chatId,
      `Assalomu alaykum, ${fullName}!\n🛍 Vitamin va dori mahsulotlari do‘koniga xush kelibsiz!`,
      { reply_markup: keyboard });
  }
});

// ✅ /add
bot.onText(/\/add/, (msg) => {
  if (!adminIds.includes(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, "📷 Rasm yuboring, so‘ng format:\nNomi;Turi;Narxi;Tavsif;Yosh");
});

// ✅ Rasm qabul qilish
bot.on('photo', async (msg) => {
  if (!adminIds.includes(msg.from.id)) return;
  const fileId = msg.photo.at(-1).file_id;
  const fileLink = await bot.getFileLink(fileId);
  tempImages[msg.from.id] = fileLink;
  bot.sendMessage(msg.chat.id, '✅ Rasm qabul qilindi. Endi format:\nNomi;Turi;Narxi;Tavsif;Yosh');
});

// ✅ Matn bilan mahsulot
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  if (!adminIds.includes(userId)) return;
  if (msg.photo) return;

  // ✅ ELON BUYRUG'I
  if (msg.text.startsWith('/elon ') && adminIds.includes(userId)) {
    const text = msg.text.replace('/elon ', '');
    for (const userId of activeUsers) {
      bot.sendMessage(userId, `📢 ${text}`).catch(() => {});
    }
    bot.sendMessage(BROADCAST_GROUP_ID, `📢 ${text}`).catch(() => {});
    return;
  }

  // ✅ Mahsulot formati
  if (tempImages[userId]) {
    const parts = msg.text.split(';');
    if (parts.length < 5) {
      return bot.sendMessage(msg.chat.id, `❌ Format xato: Nomi;Turi;Narxi;Tavsif;Yosh`);
    }

    const [name, type, price, description, age] = parts;
    try {
      const imageUrl = await uploadToImgbb(tempImages[userId]);
      const product = { name, type, price, image: imageUrl, description, age, available: true };
      await axios.post(`${BACKEND_URL}/api/products`, product);
      latestProductByAdmin[userId] = product;

      bot.sendMessage(msg.chat.id, `✅ Mahsulot qo‘shildi: ${product.name}\nYuborilsinmi?`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Ha", callback_data: `notify_yes_${userId}` },
             { text: "❌ Yo‘q", callback_data: `notify_no_${userId}` }]
          ]
        }
      });
    } catch (err) {
      bot.sendMessage(msg.chat.id, `❌ Xatolik: ${err.message}`);
    }

    delete tempImages[userId];
  }
});

// ✅ /list
bot.onText(/\/list/, async (msg) => {
  if (!adminIds.includes(msg.from.id)) return;
  const res = await axios.get(`${BACKEND_URL}/api/products`);
  for (const p of res.data) {
    const caption = `📦 <b>${p.name}</b>\n💰 ${p.price} so‘m\n📝 ${p.description}\n👶 ${p.age}+ yosh`;
    const reply_markup = {
      inline_keyboard: [[
        { text: "✏️ Tahrirlash", callback_data: `edit_${p._id}` },
        { text: "🗑 O‘chirish", callback_data: `delete_${p._id}` }
      ]]
    };
    await bot.sendPhoto(msg.chat.id, p.image, { caption, parse_mode: "HTML", reply_markup });
  }
});

// ✅ CALLBACK handler
bot.on('callback_query', async (query) => {
  const [prefix, action, value] = query.data.split('_');

  // ✅ NOTIFY
  if (prefix === 'notify') {
    const product = latestProductByAdmin[value];
    if (!product) return bot.answerCallbackQuery(query.id, { text: "⛔ Topilmadi" });

    const caption = `📢 <b>Yangi mahsulot qo‘shildi!</b>\n\n📦 <b>${product.name}</b>\n💰 ${product.price} so‘m\n📝 ${product.description}\n👶 ${product.age}+ yosh`;

    const userOptions = {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          { text: "🛒 Xarid qilish", web_app: { url: "https://telegram-miniapp-jade-gamma.vercel.app" } }
        ]]
      }
    };

    const groupCaption = `${caption}\n\n👉 <a href="https://t.me/vitaminDorilar_bot?start=from_group">Xarid qilish uchun bosing</a>`;

    if (action === 'yes') {
      for (const uid of activeUsers) {
        bot.sendPhoto(uid, product.image, { caption, ...userOptions }).catch(() => {});
      }
      bot.sendPhoto(BROADCAST_GROUP_ID, product.image, {
        caption: groupCaption,
        parse_mode: "HTML"
      }).catch(() => {});
      bot.sendMessage(query.message.chat.id, "📬 Yuborildi!");
    } else {
      bot.sendMessage(query.message.chat.id, "🚫 Yuborilmadi.");
    }

    delete latestProductByAdmin[value];
    return bot.answerCallbackQuery(query.id);
  }

  // ✅ DELETE
  if (prefix === 'delete') {
    try {
      await axios.delete(`${BACKEND_URL}/api/products/${action}`);
      await bot.editMessageCaption('🗑 Mahsulot o‘chirildi.', {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      });
    } catch (err) {
      bot.sendMessage(query.message.chat.id, `❌ Xatolik: ${err.message}`);
    }
    return bot.answerCallbackQuery(query.id);
  }

  // ✅ EDIT
  if (prefix === 'edit') {
    bot.sendMessage(query.message.chat.id, "✏️ Yangi ma’lumotni kiriting:\nNomi;Turi;Narxi;Tavsif;Yosh", {
      reply_markup: { force_reply: true }
    }).then(sent => {
      bot.onReplyToMessage(sent.chat.id, sent.message_id, async (reply) => {
        const parts = reply.text.split(';');
        if (parts.length < 5) return bot.sendMessage(sent.chat.id, '❌ Format xato.');
        const [name, type, price, description, age] = parts;
        try {
          await axios.put(`${BACKEND_URL}/api/products/${action}`, {
            name, type, price, description, age
          });
          bot.sendMessage(sent.chat.id, '✅ Mahsulot yangilandi.');
        } catch (err) {
          bot.sendMessage(sent.chat.id, `❌ Xatolik: ${err.message}`);
        }
      });
    });
    return bot.answerCallbackQuery(query.id);
  }
});

// ✅ ImgBB
async function uploadToImgbb(imageUrl) {
  const buffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const form = new FormData();
  form.append('image', Buffer.from(buffer.data).toString('base64'));
  const res = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, form, {
    headers: form.getHeaders()
  });
  return res.data.data.display_url;
}
