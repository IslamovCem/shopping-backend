const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  type: String,
  price: String,
  image: String,
  description: String,
  age: String,
  available: { type: Boolean, default: true }
});

module.exports = mongoose.model('Product', productSchema);