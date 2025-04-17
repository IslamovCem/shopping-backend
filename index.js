require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');
const FormData = require('form-data');
const axios = require('axios');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use('/api/products', productRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB ulandi');
    app.listen(PORT, () => {
      console.log(`🚀 Server ${PORT}-portda ishlamoqda`);
    });
  })
  .catch(err => {
    console.error('❌ Mongo xato:', err);
  });

// ✅ Telegram bot ishga tushadi
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("🌀 BOT YUKLANDI");

const BACKEND_URL = process.env.BACKEND_URL;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const adminIds = [1573771417];
let tempImages = {};
const activeUsers = new Set();

// ✅ /start komandasi
bot.onText(/\/start/, (msg) => {
  console.log("✅ /start buyrug‘i keldi!");

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const name = msg.from.first_name || '';
  const lastName = msg.from.last_name || '';
  const fullName = name + (lastName ? ' ' + lastName : '');

  activeUsers.add(userId);
  const usersCount = activeUsers.size;

  if (adminIds.includes(userId)) {
    bot.sendMessage(chatId, `👋 Salom, Admin ${fullName}!
📊 Foydalanuvchilar soni: ${usersCount} ta
🧾 Buyruqlar:
/add — Mahsulot qo‘shish
/list — Mahsulotlarni ko‘rish
/delete — O‘chirish`, {
      reply_markup: {
        inline_keyboard: [[
          { text: "🛍 Do‘konni ochish", web_app: { url: "https://vitamin-mini.vercel.app" } }
        ]]
      }
    });
  } else {
    bot.sendMessage(chatId, `Assalomu alaykum, ${fullName}!
🛍 Vitamin va dori mahsulotlari do‘koniga xush kelibsiz!`, {
      reply_markup: {
        keyboard: [[{ text: "🛍 Mini Do‘kon", web_app: { url: "https://vitamin-mini.vercel.app" } }]],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    });
  }
});

// ✅ /add komandasi
bot.onText(/\/add/, (msg) => {
  if (!adminIds.includes(msg.from.id)) return;
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `📷 Avval mahsulot rasmini yuboring, so‘ng quyidagi formatda yozing:
Nomi;Turi;Narxi;Tavsif;Yosh`);
});

// ✅ Rasm qabul qilish
bot.on('photo', async (msg) => {
  if (!adminIds.includes(msg.from.id)) return;

  const fileId = msg.photo[msg.photo.length - 1].file_id;
  const fileLink = await bot.getFileLink(fileId);
  tempImages[msg.from.id] = fileLink;

  bot.sendMessage(msg.chat.id, '✅ Rasm qabul qilindi. Endi quyidagi formatda yozing:\nNomi;Turi;Narxi;Tavsif;Yosh');
});

// ✅ Matn bilan mahsulot qo‘shish
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  if (!adminIds.includes(userId)) return;
  if (msg.photo) return;

  if (tempImages[userId]) {
    const parts = msg.text.split(';');
    if (parts.length < 5) {
      return bot.sendMessage(msg.chat.id, `❌ Format xato. To‘g‘ri format: Paracetamol;vitamin;18000;Tavsif;12+`);
    }

    const [name, type, price, description, age] = parts;
    try {
      const imageUrl = await uploadToImgbb(tempImages[userId]);
      const res = await axios.post(`${BACKEND_URL}/api/products`, {
        name, type, price, image: imageUrl, description, age
      });
      bot.sendMessage(msg.chat.id, `✅ Mahsulot qo‘shildi: ${res.data.name}`);
    } catch (err) {
      bot.sendMessage(msg.chat.id, `❌ Xatolik: ${err.message}`);
    }
    delete tempImages[userId];
  }
});

// ✅ /list komandasi
bot.onText(/\/list/, async (msg) => {
  if (!adminIds.includes(msg.from.id)) return;
  try {
    const res = await axios.get(`${BACKEND_URL}/api/products`);
    if (!res.data.length) return bot.sendMessage(msg.chat.id, "🚫 Mahsulot yo‘q.");

    for (const p of res.data) {
      const caption = `📦 <b>${p.name}</b>\n💰 ${p.price} so‘m\n🧾 ${p.description}\n👶 ${p.age} yoshdan`;
      const image = p.image;
      if (image && image.startsWith("http")) {
        await bot.sendPhoto(msg.chat.id, image, { caption, parse_mode: "HTML" });
      } else {
        await bot.sendMessage(msg.chat.id, caption, { parse_mode: "HTML" });
      }
    }
  } catch (err) {
    bot.sendMessage(msg.chat.id, `❌ Xatolik: ${err.message}`);
  }
});

// ✅ /delete komandasi (oddiy)
bot.onText(/\/delete/, (msg) => {
  if (!adminIds.includes(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, "🗑 O‘chirish funksiyasi hozircha faollashtirilmagan.");
});

// ✅ Rasmni ImgBB ga yuklash
async function uploadToImgbb(imageUrl) {
  const imageBuffer = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const base64Image = Buffer.from(imageBuffer.data).toString('base64');

  const form = new FormData();
  form.append('image', base64Image);

  const res = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, form, {
    headers: form.getHeaders()
  });

  return res.data.data.display_url;
}
