const db = require('../config/database');
const path = require('path');
const fs = require('fs');
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

exports.members = async (req, res) => {
    try {
        const settings = await getSettings();
        const status = req.query.status || 'all';

        let query = 'SELECT * FROM users WHERE role = ?';
        let params = ['member'];

        if (status !== 'all') {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const [members] = await db.query(query, params);

        res.render('admin/members', {
            title: 'Manajemen Member',
            settings,
            members,
            currentStatus: status
        });
    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan';
        res.redirect('/admin/dashboard');
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
        const { phone, password, name, email, address, nias, status } = req.body;

        if (!phone || !password || !name) {
            req.session.error = 'Nama, nomor HP, dan password harus diisi';
            return res.redirect('/admin/members/create');
        }

        // Check if phone already exists
        const [existing] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
        if (existing.length > 0) {
            req.session.error = 'Nomor HP sudah terdaftar';
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

        await db.query(
            'INSERT INTO users (phone, password, name, email, address, photo, nias, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [phone, hashedPassword, name, email || null, address || null, photo, nias && nias.trim() ? nias.trim() : null, 'member', status || 'pending']
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
        const { phone, name, email, address, nias, status } = req.body;
        const memberId = req.params.id;

        // Check if phone already exists for other users
        const [existingPhone] = await db.query('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, memberId]);
        if (existingPhone.length > 0) {
            req.session.error = 'Nomor HP sudah digunakan oleh user lain';
            return res.redirect('/admin/members/' + memberId);
        }

        // Check if NIAS already exists for other users (if provided)
        if (nias && nias.trim()) {
            const [existingNias] = await db.query('SELECT id FROM users WHERE nias = ? AND id != ?', [nias.trim(), memberId]);
            if (existingNias.length > 0) {
                req.session.error = 'NIAS sudah digunakan oleh member lain';
                return res.redirect('/admin/members/' + memberId);
            }
        }

        let updateQuery = 'UPDATE users SET phone = ?, name = ?, email = ?, address = ?, nias = ?, status = ?';
        let params = [phone, name, email || null, address || null, nias && nias.trim() ? nias.trim() : null, status];

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

exports.gallery = async (req, res) => {
    try {
        const settings = await getSettings();
        const [gallery] = await db.query('SELECT * FROM gallery ORDER BY sort_order ASC, created_at DESC');

        res.render('admin/gallery', {
            title: 'Manajemen Galeri',
            settings,
            gallery
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
        const [news] = await db.query('SELECT * FROM news ORDER BY created_at DESC');

        res.render('admin/news', {
            title: 'Manajemen Berita',
            settings,
            news
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
