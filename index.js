require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // << CORS qo‘shildi!
const TelegramBot = require('node-telegram-bot-api');
const FormData = require('form-data');
const axios = require('axios');
const productRoutes = require('./routes/productRoutes');

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Middlewares
app.use(cors()); // << Frontend bilan bog‘lanish uchun muhim
app.use(express.json());
app.use('/api/products', productRoutes); // << muhim marshrut

// ✅ MongoDB ulash
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

// ✅ Telegram botni ishga tushirish
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
