const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isGuest, isLoggedIn } = require('../middleware/auth');
const { uploadMember } = require('../middleware/upload');

// Login page
router.get('/login', isGuest, authController.loginPage);
router.post('/login', isGuest, authController.login);

// Register page
router.get('/register', isGuest, authController.registerPage);
router.post('/register', isGuest, uploadMember.single('photo'), authController.register);

// Logout
router.get('/logout', isLoggedIn, authController.logout);

module.exports = router;
