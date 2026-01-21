const db = require('../config/database');

// Get settings helper
const getSettings = async () => {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM site_settings');
    const settings = {};
    rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
    });
    return settings;
};

exports.home = async (req, res) => {
    try {
        const settings = await getSettings();
        const [heroSlides] = await db.query('SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 5');
        const [gallery] = await db.query('SELECT * FROM gallery WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 8');
        const [news] = await db.query('SELECT * FROM news WHERE is_published = 1 ORDER BY created_at DESC LIMIT 6');

        res.render('public/index', {
            title: settings.site_name || 'Serikat',
            settings,
            heroSlides,
            gallery,
            news
        });
    } catch (error) {
        console.error(error);
        res.render('public/index', {
            title: 'Serikat',
            settings: {},
            heroSlides: [],
            gallery: [],
            news: []
        });
    }
};

// News listing page with pagination (clean URL: /berita/page/2)
exports.newsList = async (req, res) => {
    try {
        const settings = await getSettings();

        // Support both /berita/page/:page and /berita?page=X
        let page = parseInt(req.params.page) || parseInt(req.query.page) || 1;

        // Security: validate page is positive integer, max 1000
        if (isNaN(page) || page < 1) page = 1;
        if (page > 1000) page = 1000;

        const limit = 9;
        const offset = (page - 1) * limit;

        // Get total count
        const [countResult] = await db.query('SELECT COUNT(*) as total FROM news WHERE is_published = 1');
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit) || 1;

        // 404 if page exceeds total pages (and not page 1)
        if (page > totalPages && page !== 1) {
            return res.status(404).render('public/404', {
                title: 'Halaman Tidak Ditemukan',
                settings
            });
        }

        // Get paginated news
        const [news] = await db.query(
            'SELECT * FROM news WHERE is_published = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        res.render('public/news', {
            title: (page > 1 ? `Berita - Halaman ${page}` : 'Berita') + ' - ' + (settings.site_name || 'Serikat'),
            settings,
            news,
            currentPage: page,
            totalPages,
            totalItems,
            limit
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('public/error', { title: 'Error', message: 'Terjadi kesalahan' });
    }
};

exports.newsDetail = async (req, res) => {
    try {
        const { slug } = req.params;
        const settings = await getSettings();
        const [rows] = await db.query('SELECT * FROM news WHERE slug = ? AND is_published = 1', [slug]);

        if (rows.length === 0) {
            return res.status(404).render('public/404', {
                title: 'Berita Tidak Ditemukan',
                settings
            });
        }

        // Update views
        await db.query('UPDATE news SET views = views + 1 WHERE id = ?', [rows[0].id]);

        // Get related news
        const [related] = await db.query(
            'SELECT * FROM news WHERE is_published = 1 AND id != ? ORDER BY created_at DESC LIMIT 3',
            [rows[0].id]
        );

        res.render('public/news-detail', {
            title: rows[0].title,
            settings,
            news: rows[0],
            related
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('public/error', { title: 'Error', message: 'Terjadi kesalahan' });
    }
};

exports.gallery = async (req, res) => {
    try {
        const settings = await getSettings();
        const [gallery] = await db.query('SELECT * FROM gallery WHERE is_active = 1 ORDER BY sort_order ASC');

        res.render('public/gallery', {
            title: 'Galeri - ' + (settings.site_name || 'Serikat'),
            settings,
            gallery
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('public/error', { title: 'Error', message: 'Terjadi kesalahan' });
    }
};

exports.galleryDetail = async (req, res) => {
    try {
        const { slug } = req.params;
        const settings = await getSettings();

        // Try to find by slug first, then by id
        let [rows] = await db.query('SELECT * FROM gallery WHERE slug = ? AND is_active = 1', [slug]);

        // Fallback: if slug not found, try as id (for older entries without slug)
        if (rows.length === 0 && !isNaN(slug)) {
            [rows] = await db.query('SELECT * FROM gallery WHERE id = ? AND is_active = 1', [slug]);
        }

        if (rows.length === 0) {
            return res.status(404).render('public/404', {
                title: 'Galeri Tidak Ditemukan',
                settings
            });
        }

        const galleryItem = rows[0];

        // Get related gallery items
        const [related] = await db.query(
            'SELECT * FROM gallery WHERE is_active = 1 AND id != ? ORDER BY sort_order ASC LIMIT 6',
            [galleryItem.id]
        );

        res.render('public/gallery-detail', {
            title: galleryItem.title + ' - Galeri',
            settings,
            item: galleryItem,
            related
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('public/error', { title: 'Error', message: 'Terjadi kesalahan' });
    }
};

// Komitmen detail page
exports.komitmenDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const settings = await getSettings();

        // Validate ID (1, 2, or 3)
        const featureId = parseInt(id);
        if (isNaN(featureId) || featureId < 1 || featureId > 3) {
            return res.status(404).render('public/404', {
                title: 'Halaman Tidak Ditemukan',
                settings
            });
        }

        // Get feature data from settings
        const featureData = {
            id: featureId,
            title: settings[`feature_${featureId}_title`] || getDefaultFeatureTitle(featureId),
            description: settings[`feature_${featureId}_description`] || '',
            content: settings[`feature_${featureId}_content`] || '',
            icon: settings[`feature_${featureId}_icon`] || getDefaultFeatureIcon(featureId),
            color: getFeatureColor(featureId)
        };

        // Check if content exists
        if (!featureData.content) {
            return res.status(404).render('public/404', {
                title: 'Konten Belum Tersedia',
                settings
            });
        }

        res.render('public/komitmen-detail', {
            title: featureData.title + ' - ' + (settings.site_name || 'Serikat'),
            settings,
            feature: featureData
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('public/error', { title: 'Error', message: 'Terjadi kesalahan' });
    }
};

// Helper functions for komitmen
function getDefaultFeatureTitle(id) {
    const titles = ['Perjuangan Hak Pekerja', 'Perlindungan Hukum', 'Solidaritas Berserikat'];
    return titles[id - 1] || '';
}

function getDefaultFeatureIcon(id) {
    const icons = ['fas fa-file-contract', 'fas fa-shield-alt', 'fas fa-hands-helping'];
    return icons[id - 1] || 'fas fa-star';
}

function getFeatureColor(id) {
    const colors = ['yellow', 'blue', 'red'];
    return colors[id - 1] || 'purple';
}

exports.about = async (req, res) => {
    try {
        const settings = await getSettings();

        // Get real-time member count
        const [memberCount] = await db.query("SELECT COUNT(*) as total FROM users WHERE role = 'member' AND status = 'approved'");
        const totalMembers = memberCount[0].total;

        res.render('public/tentang', {
            title: 'Tentang Kami - ' + (settings.site_name || 'Serikat'),
            settings,
            totalMembers
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('public/error', { title: 'Error', message: 'Terjadi kesalahan' });
    }
};

// Contact page
exports.contact = async (req, res) => {
    try {
        const settings = await getSettings();

        res.render('public/kontak', {
            title: (settings.contact_title || 'Hubungi Kami') + ' - ' + (settings.site_name || 'Serikat'),
            settings
        });
    } catch (error) {
        console.error(error);
        res.status(500).render('public/error', { title: 'Error', message: 'Terjadi kesalahan' });
    }
};
