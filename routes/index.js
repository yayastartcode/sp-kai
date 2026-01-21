const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Homepage
router.get('/', publicController.home);

// News listing page
router.get('/berita', publicController.newsList);
router.get('/berita/page/:page', publicController.newsList);

// News detail
router.get('/berita/:slug', publicController.newsDetail);

// Gallery page
router.get('/galeri', publicController.gallery);

// Gallery detail
router.get('/galeri/:slug', publicController.galleryDetail);

// Komitmen detail page
router.get('/komitmen/:id', publicController.komitmenDetail);

// About page
router.get('/tentang', publicController.about);

// Contact page
router.get('/kontak', publicController.contact);

module.exports = router;
