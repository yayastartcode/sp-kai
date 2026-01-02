const db = require('../config/database');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Get settings helper
const getSettings = async () => {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM site_settings');
    const settings = {};
    rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
    });
    return settings;
};

exports.dashboard = async (req, res) => {
    try {
        const settings = await getSettings();
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        const user = rows[0];

        res.render('member/dashboard', {
            title: 'Dashboard Member',
            settings,
            member: user
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/');
    }
};

exports.profile = async (req, res) => {
    try {
        const settings = await getSettings();
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);

        res.render('member/profile', {
            title: 'Profil Saya',
            settings,
            member: rows[0]
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/member/dashboard');
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, asal, address, current_password, new_password } = req.body;
        const userId = req.session.user.id;

        // Get current user data
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const user = rows[0];

        let updateFields = { name, phone: phone || null, asal: asal || null, address: address || null };

        // Handle photo upload
        if (req.file) {
            // Delete old photo if exists
            if (user.photo) {
                const oldPhotoPath = path.join(__dirname, '..', 'public', user.photo);
                if (fs.existsSync(oldPhotoPath)) {
                    fs.unlinkSync(oldPhotoPath);
                }
            }
            updateFields.photo = `/uploads/members/${req.file.filename}`;
        }

        // Handle password change
        if (current_password && new_password) {
            const isMatch = await bcrypt.compare(current_password, user.password);
            if (!isMatch) {
                req.session.error = 'Password saat ini salah';
                return res.redirect('/member/profile');
            }
            if (new_password.length < 6) {
                req.session.error = 'Password baru minimal 6 karakter';
                return res.redirect('/member/profile');
            }
            updateFields.password = await bcrypt.hash(new_password, 10);
        }

        // Build update query
        const fields = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updateFields);

        await db.query(`UPDATE users SET ${fields} WHERE id = ?`, [...values, userId]);

        // Update session
        req.session.user.name = name;
        req.session.user.phone = phone;
        req.session.user.asal = asal;
        if (updateFields.photo) {
            req.session.user.photo = updateFields.photo;
        }

        req.session.success = 'Profil berhasil diperbarui';
        res.redirect('/member/profile');

    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat memperbarui profil';
        res.redirect('/member/profile');
    }
};

exports.card = async (req, res) => {
    try {
        const settings = await getSettings();
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
        const [cards] = await db.query('SELECT * FROM member_cards WHERE user_id = ? AND card_image LIKE "%.png" ORDER BY created_at DESC LIMIT 1', [req.session.user.id]);

        res.render('member/card', {
            title: 'Kartu Anggota',
            settings,
            member: rows[0],
            card: cards[0] || null
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/member/dashboard');
    }
};

// Generate card for first time
exports.generateCard = async (req, res) => {
    try {
        const cardGeneratorCustom = require('../utils/cardGeneratorCustom');

        // Get member data
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);

        if (rows.length === 0) {
            req.session.error = 'Data member tidak ditemukan';
            return res.redirect('/member/card');
        }

        const member = rows[0];

        if (member.status !== 'approved') {
            req.session.error = 'Kartu hanya bisa di-generate untuk member yang sudah disetujui';
            return res.redirect('/member/card');
        }

        // Check if card already exists
        const [existingCard] = await db.query('SELECT id FROM member_cards WHERE user_id = ?', [member.id]);
        if (existingCard.length > 0) {
            req.session.error = 'Kartu sudah pernah di-generate, gunakan tombol Regenerate';
            return res.redirect('/member/card');
        }

        // Generate card
        const settings = await getSettings();
        const cardResult = await cardGeneratorCustom.generate(member, settings);

        // Save card info to database
        const validFrom = new Date();
        const validUntil = new Date();
        validUntil.setFullYear(validUntil.getFullYear() + 1);

        await db.query(
            `INSERT INTO member_cards (user_id, card_number, card_image, card_image_back, valid_from, valid_until) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [member.id, member.member_id, cardResult.frontImagePath, cardResult.backImagePath, validFrom, validUntil]
        );

        await db.query('UPDATE users SET card_generated_at = NOW() WHERE id = ?', [member.id]);

        req.session.success = 'Kartu anggota berhasil di-generate!';
        res.redirect('/member/card');

    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat generate kartu';
        res.redirect('/member/card');
    }
};

exports.regenerateCard = async (req, res) => {
    try {
        const cardGeneratorCustom = require('../utils/cardGeneratorCustom');

        // Get member data
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);

        if (rows.length === 0) {
            req.session.error = 'Data member tidak ditemukan';
            return res.redirect('/member/card');
        }

        const member = rows[0];

        if (member.status !== 'approved') {
            req.session.error = 'Kartu hanya bisa di-generate untuk member yang sudah disetujui';
            return res.redirect('/member/card');
        }

        // Generate card
        const settings = await getSettings();
        const cardResult = await cardGeneratorCustom.generate(member, settings);

        // Save card info to database
        const validFrom = new Date();
        const validUntil = new Date();
        validUntil.setFullYear(validUntil.getFullYear() + 1);

        await db.query(
            `INSERT INTO member_cards (user_id, card_number, card_image, card_image_back, valid_from, valid_until) 
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE card_image = ?, card_image_back = ?, valid_from = ?, valid_until = ?`,
            [member.id, member.member_id, cardResult.frontImagePath, cardResult.backImagePath, validFrom, validUntil,
            cardResult.frontImagePath, cardResult.backImagePath, validFrom, validUntil]
        );

        await db.query('UPDATE users SET card_generated_at = NOW() WHERE id = ?', [member.id]);

        // Delete old card files
        try {
            const cardsDir = path.join(__dirname, '..', 'public', 'uploads', 'cards');
            const files = fs.readdirSync(cardsDir);
            const memberCardPrefix = `card-${member.member_id}-`;

            files.forEach(file => {
                if (file.startsWith(memberCardPrefix) &&
                    file !== cardResult.frontFilename &&
                    file !== cardResult.backFilename) {
                    const oldFilePath = path.join(cardsDir, file);
                    try {
                        fs.unlinkSync(oldFilePath);
                        console.log(`Deleted old card: ${file}`);
                    } catch (deleteErr) {
                        console.warn(`Could not delete old card: ${file}`);
                    }
                }
            });
        } catch (cleanupErr) {
            console.warn('Card cleanup error:', cleanupErr.message);
        }

        req.session.success = 'Kartu berhasil di-update';
        res.redirect('/member/card');

    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat update kartu';
        res.redirect('/member/card');
    }
};

exports.downloadCard = async (req, res) => {
    try {
        const [cards] = await db.query(
            'SELECT * FROM member_cards WHERE user_id = ? AND card_image LIKE "%.png" ORDER BY created_at DESC LIMIT 1',
            [req.session.user.id]
        );

        if (cards.length === 0 || !cards[0].card_image) {
            req.session.error = 'Kartu anggota belum tersedia';
            return res.redirect('/member/card');
        }

        const card = cards[0];
        const frontCardPath = path.join(__dirname, '..', 'public', card.card_image);

        // Use NIAS for filename, fallback to member_id
        const fileIdentifier = req.session.user.nias || req.session.user.member_id;

        if (!fs.existsSync(frontCardPath)) {
            req.session.error = 'File kartu tidak ditemukan';
            return res.redirect('/member/card');
        }

        // If back card exists, combine them
        if (card.card_image_back) {
            const backCardPath = path.join(__dirname, '..', 'public', card.card_image_back);

            if (fs.existsSync(backCardPath)) {
                const sharp = require('sharp');

                // Get dimensions of front card
                const frontMeta = await sharp(frontCardPath).metadata();
                const cardWidth = frontMeta.width;
                const cardHeight = frontMeta.height;

                // Margin between cards (in pixels)
                const margin = 40;

                // Load both images
                const frontBuffer = await sharp(frontCardPath).toBuffer();
                const backBuffer = await sharp(backCardPath)
                    .resize(cardWidth, cardHeight, { fit: 'fill' })
                    .toBuffer();

                // Combine vertically (top-bottom) with margin
                const combinedBuffer = await sharp({
                    create: {
                        width: cardWidth,
                        height: (cardHeight * 2) + margin,
                        channels: 4,
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    }
                })
                    .composite([
                        { input: frontBuffer, top: 0, left: 0 },
                        { input: backBuffer, top: cardHeight + margin, left: 0 }
                    ])
                    .png()
                    .toBuffer();

                // Send combined image
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Content-Disposition', `attachment; filename=kartu-anggota-${fileIdentifier}.png`);
                return res.send(combinedBuffer);
            }
        }

        // Fallback: just download front card
        res.download(frontCardPath, `kartu-anggota-${fileIdentifier}.png`);

    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat mengunduh kartu';
        res.redirect('/member/card');
    }
};
