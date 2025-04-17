const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET
router.get('/', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// POST
router.post('/', async (req, res) => {
  const product = await Product.create(req.body);
  res.json(product);
});

// PUT
router.put('/:id', async (req, res) => {
  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

// DELETE
router.delete('/:id', async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'O‘chirildi' });
});

module.exports = router;