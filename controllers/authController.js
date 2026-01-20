const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Get settings helper
const getSettings = async () => {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM site_settings');
    const settings = {};
    rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
    });
    return settings;
};

exports.loginPage = async (req, res) => {
    try {
        const settings = await getSettings();
        res.render('auth/login', {
            title: 'Login',
            layout: 'layouts/main',
            settings
        });
    } catch (error) {
        console.error(error);
        res.render('auth/login', {
            title: 'Login',
            layout: 'layouts/main',
            settings: {}
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { nipp, password } = req.body;

        // Validate input
        if (!nipp || !password) {
            req.session.error = 'NIPP dan password harus diisi';
            return res.redirect('/login');
        }

        // Find user by NIPP
        const [rows] = await db.query('SELECT * FROM users WHERE nipp = ?', [nipp]);

        if (rows.length === 0) {
            req.session.error = 'NIPP tidak terdaftar';
            return res.redirect('/login');
        }

        const user = rows[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            req.session.error = 'Password salah';
            return res.redirect('/login');
        }

        // Set session
        req.session.user = {
            id: user.id,
            nipp: user.nipp,
            phone: user.phone,
            name: user.name,
            photo: user.photo,
            role: user.role,
            status: user.status,
            member_id: user.member_id,
            nias: user.nias,
            asal: user.asal
        };

        req.session.success = 'Login berhasil';

        // Redirect based on role
        if (user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        }
        res.redirect('/member/dashboard');

    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat login';
        res.redirect('/login');
    }
};

exports.registerPage = async (req, res) => {
    try {
        const settings = await getSettings();
        res.render('auth/register', {
            title: 'Daftar Member',
            layout: 'layouts/main',
            settings
        });
    } catch (error) {
        console.error(error);
        res.render('auth/register', {
            title: 'Daftar Member',
            layout: 'layouts/main',
            settings: {}
        });
    }
};

exports.register = async (req, res) => {
    try {
        const { nipp, password, password_confirm, name, phone, address, tempat_lahir, tanggal_lahir, asal, contribution_type } = req.body;

        // Validate input
        if (!nipp || !password || !name || !tempat_lahir || !tanggal_lahir || !asal || !contribution_type) {
            req.session.error = 'Semua field wajib harus diisi';
            return res.redirect('/register');
        }

        if (password !== password_confirm) {
            req.session.error = 'Password dan konfirmasi password tidak sama';
            return res.redirect('/register');
        }

        if (password.length < 6) {
            req.session.error = 'Password minimal 6 karakter';
            return res.redirect('/register');
        }

        // Check if NIPP already exists
        const [existingNipp] = await db.query('SELECT id FROM users WHERE nipp = ?', [nipp.trim()]);
        if (existingNipp.length > 0) {
            req.session.error = 'NIPP sudah terdaftar';
            return res.redirect('/register');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Get photo if uploaded
        const photo = req.file ? `/uploads/members/${req.file.filename}` : null;

        // Generate member_id
        const memberId = `MBR${String(Date.now()).slice(-8)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        // Insert user - using 'asal' column only
        await db.query(
            `INSERT INTO users (nipp, password, name, phone, address, photo, tempat_lahir, tanggal_lahir, asal, contribution_type, role, status, member_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nipp.trim(), hashedPassword, name, phone || null, address || null, photo, tempat_lahir, tanggal_lahir, asal, contribution_type, 'member', 'pending', memberId]
        );

        req.session.success = 'Pendaftaran berhasil! Silakan login untuk melanjutkan proses.';
        res.redirect('/login');

    } catch (error) {
        console.error(error);
        req.session.error = 'Terjadi kesalahan saat mendaftar';
        res.redirect('/register');
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);
        res.redirect('/');
    });
};
