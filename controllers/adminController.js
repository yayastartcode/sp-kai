const db = require('../config/database');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const cardGeneratorCustom = require('../utils/cardGeneratorCustom');

// Get settings helper
const getSettings = async () => {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM site_settings');
    const settings = {};
    rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
    });
    return settings;
};

// Generate slug helper
const generateSlug = (text) => {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
};

exports.dashboard = async (req, res) => {
    try {
        const settings = await getSettings();
        const [totalMembers] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = ?', ['member']);
        const [pendingMembers] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = ? AND status = ?', ['member', 'pending']);
        const [totalNews] = await db.query('SELECT COUNT(*) as count FROM news');
        const [totalGallery] = await db.query('SELECT COUNT(*) as count FROM gallery');
        const [recentMembers] = await db.query('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC LIMIT 5', ['member']);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            settings,
            stats: {
                totalMembers: totalMembers[0].count,
                pendingMembers: pendingMembers[0].count,
                totalNews: totalNews[0].count,
                totalGallery: totalGallery[0].count
            },
            recentMembers
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/');
    }
};

exports.settings = async (req, res) => {
    try {
        const settings = await getSettings();
        res.render('admin/settings', {
            title: 'Pengaturan Website',
            settings
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/dashboard');
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const settingsToUpdate = req.body;

        for (const [key, value] of Object.entries(settingsToUpdate)) {
            await db.query(
                'UPDATE site_settings SET setting_value = ? WHERE setting_key = ?',
                [value, key]
            );
        }

        req.session.success = 'Pengaturan berhasil diperbarui';
        res.redirect('/admin/settings');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/settings');
    }
};

exports.uploadLogo = async (req, res) => {
    try {
        if (!req.file) {
            req.session.error = 'File logo harus diupload';
            return res.redirect('/admin/settings');
        }

        // Get old logo to delete
        const [oldLogo] = await db.query('SELECT setting_value FROM site_settings WHERE setting_key = ?', ['logo_image']);
        if (oldLogo[0]?.setting_value) {
            const oldPath = path.join(__dirname, '..', 'public', oldLogo[0].setting_value);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        const logoPath = `/uploads/gallery/${req.file.filename}`;
        await db.query('UPDATE site_settings SET setting_value = ? WHERE setting_key = ?', [logoPath, 'logo_image']);

        req.session.success = 'Logo berhasil diupload';
        res.redirect('/admin/settings');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat upload logo';
        res.redirect('/admin/settings');
    }
};

exports.uploadAboutImage = async (req, res) => {
    try {
        console.log('uploadAboutImage called');
        console.log('req.file:', req.file);

        if (!req.file) {
            req.session.error = 'File gambar harus diupload';
            return res.redirect('/admin/settings');
        }

        // Get old about image to delete
        const [oldAbout] = await db.query('SELECT setting_value FROM site_settings WHERE setting_key = ?', ['about_image']);
        if (oldAbout[0]?.setting_value && oldAbout[0].setting_value !== '/images/about.jpg') {
            const oldPath = path.join(__dirname, '..', 'public', oldAbout[0].setting_value);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        const aboutImagePath = `/uploads/about/${req.file.filename}`;
        console.log('Saving about_image path:', aboutImagePath);

        await db.query('UPDATE site_settings SET setting_value = ? WHERE setting_key = ?', [aboutImagePath, 'about_image']);

        req.session.success = 'Gambar about berhasil diupload';
        res.redirect('/admin/settings');
    } catch (error) {
        console.error('uploadAboutImage error:', error);
        req.session.error = 'Terjadi kesalahan saat upload gambar';
        res.redirect('/admin/settings');
    }
};

exports.uploadChairmanPhoto = async (req, res) => {
    try {
        if (!req.file) {
            req.session.error = 'File foto harus diupload';
            return res.redirect('/admin/settings');
        }

        // Get old chairman photo to delete
        const [oldPhoto] = await db.query('SELECT setting_value FROM site_settings WHERE setting_key = ?', ['chairman_photo']);
        if (oldPhoto[0]?.setting_value) {
            const oldPath = path.join(__dirname, '..', 'public', oldPhoto[0].setting_value);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        const photoPath = `/uploads/about/${req.file.filename}`;

        await db.query('UPDATE site_settings SET setting_value = ? WHERE setting_key = ?', [photoPath, 'chairman_photo']);

        req.session.success = 'Foto Ketua Umum berhasil diupload';
        res.redirect('/admin/settings');
    } catch (error) {
        console.error('uploadChairmanPhoto error:', error);
        req.session.error = 'Terjadi kesalahan saat upload foto';
        res.redirect('/admin/settings');
    }
};

exports.members = async (req, res) => {
    try {
        const settings = await getSettings();
        const status = req.query.status || 'all';
        const contribution = req.query.contribution || '';
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 20; // Members per page
        const offset = (page - 1) * limit;

        let baseQuery = 'FROM users WHERE role = ?';
        let params = ['member'];

        // Status filter
        if (status !== 'all') {
            baseQuery += ' AND status = ?';
            params.push(status);
        }

        // Contribution type filter
        if (contribution && (contribution === 'transfer' || contribution === 'salary_deduction')) {
            baseQuery += ' AND contribution_type = ?';
            params.push(contribution);
        }

        // Search filter
        if (search) {
            baseQuery += ' AND (name LIKE ? OR nipp LIKE ? OR nias LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // Get total count for pagination
        const [countResult] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
        const totalMembers = countResult[0].total;
        const totalPages = Math.ceil(totalMembers / limit);

        // Get paginated members
        const query = `SELECT * ${baseQuery} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        const [members] = await db.query(query, [...params, limit, offset]);

        res.render('admin/members', {
            title: 'Manajemen Member',
            settings,
            members,
            currentStatus: status,
            currentContribution: contribution,
            search,
            currentPage: page,
            totalPages,
            totalMembers,
            limit
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/dashboard');
    }
};

// Export all members to Excel
exports.exportMembers = async (req, res) => {
    try {
        // Get all approved members
        const [members] = await db.query(
            'SELECT nipp, name, asal, nias FROM users WHERE role = ? ORDER BY name ASC',
            ['member']
        );

        // Prepare data with headers
        const data = [
            ['NO', 'NIPP', 'NAMA', 'ASAL', 'NIAS']  // Headers
        ];

        // Add member data
        members.forEach((member, index) => {
            data.push([
                index + 1,
                member.nipp || '',
                member.name || '',
                member.asal || '',
                member.nias || ''
            ]);
        });

        // Create workbook and worksheet
        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.aoa_to_sheet(data);

        // Set column widths
        worksheet['!cols'] = [
            { wch: 5 },   // NO
            { wch: 15 },  // NIPP
            { wch: 35 },  // NAMA
            { wch: 30 },  // ASAL
            { wch: 15 }   // NIAS
        ];

        xlsx.utils.book_append_sheet(workbook, worksheet, 'Members');

        // Generate buffer
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set response headers
        const filename = `data-member-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);

    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat export data';
        res.redirect('/admin/members');
    }
};

exports.memberDetail = async (req, res) => {
    try {
        const settings = await getSettings();
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            req.session.error = 'Member tidak ditemukan';
            return res.redirect('/admin/members');
        }

        const [cards] = await db.query('SELECT * FROM member_cards WHERE user_id = ? AND card_image LIKE "%.png" ORDER BY created_at DESC LIMIT 1', [req.params.id]);

        res.render('admin/member-detail', {
            title: 'Detail Member',
            settings,
            member: rows[0],
            card: cards[0] || null
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/members');
    }
};

exports.approveMember = async (req, res) => {
    try {
        const memberId = req.params.id;

        // Generate member ID
        const [count] = await db.query('SELECT COUNT(*) as count FROM users WHERE member_id IS NOT NULL');
        const memberNumber = String(count[0].count + 1).padStart(5, '0');
        const newMemberId = `MBR${memberNumber}`;

        await db.query(
            'UPDATE users SET status = ?, member_id = ? WHERE id = ?',
            ['approved', newMemberId, memberId]
        );

        req.session.success = 'Member berhasil disetujui';
        res.redirect('/admin/members/' + memberId);
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/members');
    }
};

exports.rejectMember = async (req, res) => {
    try {
        await db.query('UPDATE users SET status = ? WHERE id = ?', ['rejected', req.params.id]);
        req.session.success = 'Member ditolak';
        res.redirect('/admin/members');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/members');
    }
};

exports.createMemberPage = async (req, res) => {
    try {
        const settings = await getSettings();
        res.render('admin/member-create', {
            title: 'Tambah Member Baru',
            settings
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/members');
    }
};

exports.createMember = async (req, res) => {
    try {
        const { nipp, password, name, phone, address, nias, asal, status } = req.body;

        if (!nipp || !password || !name) {
            req.session.error = 'Nama, NIPP, dan password harus diisi';
            return res.redirect('/admin/members/create');
        }

        // Check if NIPP already exists
        const [existingNipp] = await db.query('SELECT id FROM users WHERE nipp = ?', [nipp.trim()]);
        if (existingNipp.length > 0) {
            req.session.error = 'NIPP sudah terdaftar';
            return res.redirect('/admin/members/create');
        }

        // Check if NIAS already exists (if provided)
        if (nias && nias.trim()) {
            const [existingNias] = await db.query('SELECT id FROM users WHERE nias = ?', [nias.trim()]);
            if (existingNias.length > 0) {
                req.session.error = 'NIAS sudah digunakan oleh member lain';
                return res.redirect('/admin/members/create');
            }
        }

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);
        const photo = req.file ? `/uploads/members/${req.file.filename}` : null;

        // Generate member_id
        const memberId = `MBR${String(Date.now()).slice(-8)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        await db.query(
            'INSERT INTO users (nipp, password, name, phone, address, photo, nias, asal, role, status, member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nipp.trim(), hashedPassword, name, phone || null, address || null, photo, nias && nias.trim() ? nias.trim() : null, asal || null, 'member', status || 'pending', memberId]
        );

        req.session.success = 'Member berhasil ditambahkan';
        res.redirect('/admin/members');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/members/create');
    }
};

exports.updateMember = async (req, res) => {
    try {
        const { nipp, phone, name, address, nias, asal, status } = req.body;
        const memberId = req.params.id;

        // Check if NIPP already exists for other users
        if (nipp && nipp.trim()) {
            const [existingNipp] = await db.query('SELECT id FROM users WHERE nipp = ? AND id != ?', [nipp.trim(), memberId]);
            if (existingNipp.length > 0) {
                req.session.error = 'NIPP sudah digunakan oleh user lain';
                return res.redirect('/admin/members/' + memberId);
            }
        }

        // Check if NIAS already exists for other users (if provided)
        if (nias && nias.trim()) {
            const [existingNias] = await db.query('SELECT id FROM users WHERE nias = ? AND id != ?', [nias.trim(), memberId]);
            if (existingNias.length > 0) {
                req.session.error = 'NIAS sudah digunakan oleh member lain';
                return res.redirect('/admin/members/' + memberId);
            }
        }

        let updateQuery = 'UPDATE users SET nipp = ?, phone = ?, name = ?, address = ?, nias = ?, asal = ?, status = ?';
        let params = [nipp && nipp.trim() ? nipp.trim() : null, phone || null, name, address || null, nias && nias.trim() ? nias.trim() : null, asal || null, status];

        // Add photo if uploaded
        if (req.file) {
            updateQuery += ', photo = ?';
            params.push(`/uploads/members/${req.file.filename}`);
        }

        updateQuery += ' WHERE id = ?';
        params.push(memberId);

        await db.query(updateQuery, params);

        req.session.success = 'Data member berhasil diperbarui';
        res.redirect('/admin/members/' + memberId);
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/members/' + req.params.id);
    }
};

exports.deleteMember = async (req, res) => {
    try {
        const memberId = req.params.id;

        // Get member to check if exists and get photo path
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [memberId]);
        if (rows.length === 0) {
            req.session.error = 'Member tidak ditemukan';
            return res.redirect('/admin/members');
        }

        // Delete member card if exists
        await db.query('DELETE FROM member_cards WHERE user_id = ?', [memberId]);

        // Delete member
        await db.query('DELETE FROM users WHERE id = ?', [memberId]);

        req.session.success = 'Member berhasil dihapus';
        res.redirect('/admin/members');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat menghapus member';
        res.redirect('/admin/members');
    }
};

exports.generateCard = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            req.session.error = 'Member tidak ditemukan';
            return res.redirect('/admin/members');
        }

        const member = rows[0];

        if (member.status !== 'approved') {
            req.session.error = 'Member harus disetujui terlebih dahulu';
            return res.redirect('/admin/members/' + member.id);
        }

        // Generate card using custom template
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

        // Delete old card files for this member
        try {
            const cardsDir = path.join(__dirname, '..', 'public', 'uploads', 'cards');
            const files = fs.readdirSync(cardsDir);
            const memberCardPrefix = `card-${member.member_id}-`;

            files.forEach(file => {
                // Keep only the newly generated files
                if (file.startsWith(memberCardPrefix) &&
                    file !== cardResult.frontFilename &&
                    file !== cardResult.backFilename) {
                    const oldFilePath = path.join(cardsDir, file);
                    try {
                        fs.unlinkSync(oldFilePath);
                        console.log(`Deleted old card: ${file}`);
                    } catch (deleteErr) {
                        console.warn(`Failed to delete old card ${file}:`, deleteErr.message);
                    }
                }
            });
        } catch (cleanupErr) {
            console.warn('Card cleanup error:', cleanupErr.message);
            // Don't fail the request if cleanup fails
        }

        req.session.success = 'Kartu anggota berhasil dibuat';
        res.redirect('/admin/members/' + member.id);
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat membuat kartu: ' + error.message;
        res.redirect('/admin/members/' + req.params.id);
    }
};

// Download card for admin
exports.downloadCard = async (req, res) => {
    try {
        const memberId = req.params.id;

        // Get member and card data
        const [members] = await db.query('SELECT * FROM users WHERE id = ?', [memberId]);
        if (members.length === 0) {
            req.session.error = 'Member tidak ditemukan';
            return res.redirect('/admin/members');
        }

        const member = members[0];
        const [cards] = await db.query('SELECT * FROM member_cards WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [memberId]);

        if (cards.length === 0 || !cards[0].card_image) {
            req.session.error = 'Kartu tidak ditemukan';
            return res.redirect('/admin/members/' + memberId);
        }

        const card = cards[0];
        const frontPath = path.join(__dirname, '..', 'public', card.card_image);
        const fileIdentifier = member.nias || member.nipp || member.member_id;

        if (!fs.existsSync(frontPath)) {
            req.session.error = 'File kartu tidak ditemukan';
            return res.redirect('/admin/members/' + memberId);
        }

        // If back card exists, combine them
        if (card.card_image_back) {
            const backPath = path.join(__dirname, '..', 'public', card.card_image_back);

            if (fs.existsSync(backPath)) {
                const sharp = require('sharp');

                // Get dimensions of front card
                const frontMeta = await sharp(frontPath).metadata();
                const cardWidth = frontMeta.width;
                const cardHeight = frontMeta.height;

                // Margin between cards (in pixels)
                const margin = 40;

                // Load both images
                const frontBuffer = await sharp(frontPath).toBuffer();
                const backBuffer = await sharp(backPath)
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
                res.setHeader('Content-Disposition', `attachment; filename=kartu-${fileIdentifier}.png`);
                return res.send(combinedBuffer);
            }
        }

        // Fallback: just download front card
        res.download(frontPath, `kartu-${fileIdentifier}.png`);

    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat download kartu';
        res.redirect('/admin/members/' + req.params.id);
    }
};

// Download member registration letter for admin as PDF
exports.downloadMemberLetter = async (req, res) => {
    try {
        const memberId = req.params.id;
        const letterType = req.params.type; // 'pendaftaran' or 'kuasa'

        // Get member data
        const [members] = await db.query('SELECT * FROM users WHERE id = ?', [memberId]);
        if (members.length === 0) {
            req.session.error = 'Member tidak ditemukan';
            return res.redirect('/admin/members');
        }

        const member = members[0];

        // Validate letter type for kuasa
        if (letterType === 'kuasa' && member.contribution_type !== 'salary_deduction') {
            req.session.error = 'Surat kuasa hanya untuk pilihan potong gaji';
            return res.redirect('/admin/members/' + memberId);
        }

        // Generate PDF
        const letterGenerator = require('../utils/letterGenerator');
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const pdfBuffer = await letterGenerator.generateLetterPDF(member, letterType, baseUrl);

        // Send PDF
        const filename = letterType === 'pendaftaran'
            ? `Surat_Pendaftaran_${member.nipp}.pdf`
            : `Surat_Kuasa_${member.nipp}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat download surat';
        res.redirect('/admin/members/' + req.params.id);
    }
};

// Reset member password (admin)
exports.resetMemberPassword = async (req, res) => {
    try {
        const memberId = req.params.id;
        const { new_password, confirm_password } = req.body;

        // Validate passwords
        if (!new_password || !confirm_password) {
            req.session.error = 'Password baru dan konfirmasi harus diisi';
            return res.redirect('/admin/members/' + memberId);
        }

        if (new_password.length < 6) {
            req.session.error = 'Password minimal 6 karakter';
            return res.redirect('/admin/members/' + memberId);
        }

        if (new_password !== confirm_password) {
            req.session.error = 'Konfirmasi password tidak cocok';
            return res.redirect('/admin/members/' + memberId);
        }

        // Check if member exists
        const [members] = await db.query('SELECT id, name FROM users WHERE id = ?', [memberId]);
        if (members.length === 0) {
            req.session.error = 'Member tidak ditemukan';
            return res.redirect('/admin/members');
        }

        // Hash new password
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(new_password, 10);

        // Update password
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, memberId]);

        req.session.success = `Password member ${members[0].name} berhasil direset`;
        res.redirect('/admin/members/' + memberId);

    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat reset password';
        res.redirect('/admin/members/' + req.params.id);
    }
};

exports.gallery = async (req, res) => {
    try {
        const settings = await getSettings();
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const offset = (page - 1) * limit;

        // Get total count
        const [countResult] = await db.query('SELECT COUNT(*) as total FROM gallery');
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        // Get paginated gallery
        const [gallery] = await db.query(
            'SELECT * FROM gallery ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        res.render('admin/gallery', {
            title: 'Manajemen Galeri',
            settings,
            gallery,
            currentPage: page,
            totalPages,
            totalItems,
            limit
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/dashboard');
    }
};

exports.addGallery = async (req, res) => {
    try {
        const { title, description, sort_order } = req.body;

        if (!req.file) {
            req.session.error = 'Gambar harus diupload';
            return res.redirect('/admin/gallery');
        }

        const image = `/uploads/gallery/${req.file.filename}`;
        const slug = generateSlug(title) + '-' + Date.now();

        await db.query(
            'INSERT INTO gallery (title, slug, image, description, sort_order) VALUES (?, ?, ?, ?, ?)',
            [title, slug, image, description || null, sort_order || 0]
        );

        req.session.success = 'Foto berhasil ditambahkan';
        res.redirect('/admin/gallery');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/gallery');
    }
};

exports.deleteGallery = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM gallery WHERE id = ?', [req.params.id]);

        if (rows.length > 0 && rows[0].image) {
            const imagePath = path.join(__dirname, '..', 'public', rows[0].image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await db.query('DELETE FROM gallery WHERE id = ?', [req.params.id]);

        req.session.success = 'Foto berhasil dihapus';
        res.redirect('/admin/gallery');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/gallery');
    }
};

exports.news = async (req, res) => {
    try {
        const settings = await getSettings();
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        // Get total count
        const [countResult] = await db.query('SELECT COUNT(*) as total FROM news');
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        // Get paginated news
        const [news] = await db.query(
            'SELECT * FROM news ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        res.render('admin/news', {
            title: 'Manajemen Berita',
            settings,
            news,
            currentPage: page,
            totalPages,
            totalItems,
            limit
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/dashboard');
    }
};

exports.createNewsPage = async (req, res) => {
    try {
        const settings = await getSettings();
        res.render('admin/news-form', {
            title: 'Tambah Berita',
            settings,
            news: null,
            isEdit: false
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/news');
    }
};

exports.createNews = async (req, res) => {
    try {
        const { title, content, is_published } = req.body;
        const slug = generateSlug(title) + '-' + Date.now();
        const image = req.file ? `/uploads/news/${req.file.filename}` : null;

        await db.query(
            'INSERT INTO news (title, slug, content, image, is_published, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [title, slug, content, image, is_published === 'on' ? 1 : 0, req.session.user.id]
        );

        req.session.success = 'Berita berhasil ditambahkan';
        res.redirect('/admin/news');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/news');
    }
};

exports.editNewsPage = async (req, res) => {
    try {
        const settings = await getSettings();
        const [rows] = await db.query('SELECT * FROM news WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            req.session.error = 'Berita tidak ditemukan';
            return res.redirect('/admin/news');
        }

        res.render('admin/news-form', {
            title: 'Edit Berita',
            settings,
            news: rows[0],
            isEdit: true
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/news');
    }
};

exports.updateNews = async (req, res) => {
    try {
        const { title, content, is_published } = req.body;
        const [rows] = await db.query('SELECT * FROM news WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            req.session.error = 'Berita tidak ditemukan';
            return res.redirect('/admin/news');
        }

        let image = rows[0].image;

        if (req.file) {
            // Delete old image
            if (rows[0].image) {
                const oldPath = path.join(__dirname, '..', 'public', rows[0].image);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            image = `/uploads/news/${req.file.filename}`;
        }

        await db.query(
            'UPDATE news SET title = ?, content = ?, image = ?, is_published = ? WHERE id = ?',
            [title, content, image, is_published === 'on' ? 1 : 0, req.params.id]
        );

        req.session.success = 'Berita berhasil diperbarui';
        res.redirect('/admin/news');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/news');
    }
};

exports.deleteNews = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM news WHERE id = ?', [req.params.id]);

        if (rows.length > 0 && rows[0].image) {
            const imagePath = path.join(__dirname, '..', 'public', rows[0].image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await db.query('DELETE FROM news WHERE id = ?', [req.params.id]);

        req.session.success = 'Berita berhasil dihapus';
        res.redirect('/admin/news');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/news');
    }
};

exports.togglePublish = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT is_published FROM news WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            req.session.error = 'Berita tidak ditemukan';
            return res.redirect('/admin/news');
        }

        const newStatus = rows[0].is_published ? 0 : 1;
        await db.query('UPDATE news SET is_published = ? WHERE id = ?', [newStatus, req.params.id]);

        req.session.success = newStatus ? 'Berita dipublikasikan' : 'Berita disembunyikan';
        res.redirect('/admin/news');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/news');
    }
};

// Hero Slides Management
exports.heroSlides = async (req, res) => {
    try {
        const settings = await getSettings();
        const [slides] = await db.query('SELECT * FROM hero_slides ORDER BY sort_order ASC, created_at DESC');

        res.render('admin/hero-slides', {
            title: 'Manajemen Hero Slider',
            settings,
            slides
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/dashboard');
    }
};

exports.addHeroSlide = async (req, res) => {
    try {
        const { title, sort_order } = req.body;

        if (!req.file) {
            req.session.error = 'Gambar harus diupload';
            return res.redirect('/admin/hero-slides');
        }

        const image = `/uploads/gallery/${req.file.filename}`;

        await db.query(
            'INSERT INTO hero_slides (image, title, sort_order) VALUES (?, ?, ?)',
            [image, title || null, sort_order || 0]
        );

        req.session.success = 'Slide berhasil ditambahkan';
        res.redirect('/admin/hero-slides');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/hero-slides');
    }
};

exports.deleteHeroSlide = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM hero_slides WHERE id = ?', [req.params.id]);

        if (rows.length > 0 && rows[0].image) {
            const imagePath = path.join(__dirname, '..', 'public', rows[0].image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await db.query('DELETE FROM hero_slides WHERE id = ?', [req.params.id]);

        req.session.success = 'Slide berhasil dihapus';
        res.redirect('/admin/hero-slides');
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/hero-slides');
    }
};
