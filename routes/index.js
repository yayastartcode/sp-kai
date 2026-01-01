const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Homepage
router.get('/', publicController.home);

// News detail
router.get('/berita/:slug', publicController.newsDetail);

// Gallery page
router.get('/galeri', publicController.gallery);

// Gallery detail
router.get('/galeri/:slug', publicController.galleryDetail);

// About page
router.get('/tentang', publicController.about);

module.exports = router;
