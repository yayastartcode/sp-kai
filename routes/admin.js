const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { uploadGallery, uploadNews, uploadAbout, uploadMember } = require('../middleware/upload');

// Apply middleware to all admin routes
router.use(isLoggedIn, isAdmin);

// Dashboard
router.get('/dashboard', adminController.dashboard);

// Site Settings
router.get('/settings', adminController.settings);
router.post('/settings', adminController.updateSettings);
router.post('/settings/logo', uploadGallery.single('logo'), adminController.uploadLogo);
router.post('/settings/about-image', uploadAbout.single('about_image'), adminController.uploadAboutImage);
router.post('/settings/chairman-photo', uploadAbout.single('chairman_photo'), adminController.uploadChairmanPhoto);

// Members Management
router.get('/members', adminController.members);
router.get('/members/create', adminController.createMemberPage);
router.post('/members/create', uploadMember.single('photo'), adminController.createMember);
router.get('/members/:id', adminController.memberDetail);
router.post('/members/:id/update', uploadMember.single('photo'), adminController.updateMember);
router.post('/members/:id/approve', adminController.approveMember);
router.post('/members/:id/reject', adminController.rejectMember);
router.post('/members/:id/generate-card', adminController.generateCard);
router.get('/members/:id/download-card', adminController.downloadCard);
router.post('/members/:id/delete', adminController.deleteMember);

// Hero Slides Management
router.get('/hero-slides', adminController.heroSlides);
router.post('/hero-slides', uploadGallery.single('image'), adminController.addHeroSlide);
router.post('/hero-slides/:id/delete', adminController.deleteHeroSlide);

// Gallery Management
router.get('/gallery', adminController.gallery);
router.post('/gallery', uploadGallery.single('image'), adminController.addGallery);
router.post('/gallery/:id/delete', adminController.deleteGallery);

// News Management
router.get('/news', adminController.news);
router.get('/news/create', adminController.createNewsPage);
router.post('/news', uploadNews.single('image'), adminController.createNews);
router.get('/news/:id/edit', adminController.editNewsPage);
router.post('/news/:id', uploadNews.single('image'), adminController.updateNews);
router.post('/news/:id/delete', adminController.deleteNews);
router.post('/news/:id/toggle-publish', adminController.togglePublish);

module.exports = router;
