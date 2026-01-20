const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { isLoggedIn, isMember, isApprovedMember } = require('../middleware/auth');
const { uploadMember } = require('../middleware/upload');

// Apply isLoggedIn middleware to all routes
router.use(isLoggedIn);

// Dashboard
router.get('/dashboard', memberController.dashboard);

// Profile
router.get('/profile', memberController.profile);
router.post('/profile', uploadMember.single('photo'), memberController.updateProfile);

// Member Card (only for approved members)
router.get('/card', isApprovedMember, memberController.card);
router.get('/card/download', isApprovedMember, memberController.downloadCard);
router.post('/card/generate', isApprovedMember, memberController.generateCard);
router.post('/card/regenerate', isApprovedMember, memberController.regenerateCard);

// Registration letters (for pending members)
router.get('/letter/:type', memberController.downloadLetter);
router.post('/upload-signed-letter', uploadMember.single('signed_letter'), memberController.uploadSignedLetter);

module.exports = router;

