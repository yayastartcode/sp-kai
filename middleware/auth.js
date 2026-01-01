// Check if user is logged in
const isLoggedIn = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    req.session.error = 'Silakan login terlebih dahulu';
    res.redirect('/login');
};

// Check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.session.error = 'Akses ditolak. Hanya admin yang dapat mengakses halaman ini.';
    res.redirect('/');
};

// Check if user is member
const isMember = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'member') {
        return next();
    }
    req.session.error = 'Akses ditolak.';
    res.redirect('/');
};

// Check if user is approved member
const isApprovedMember = (req, res, next) => {
    if (req.session.user && req.session.user.status === 'approved') {
        return next();
    }
    req.session.error = 'Akun Anda belum disetujui oleh admin.';
    res.redirect('/member/dashboard');
};

// Redirect if already logged in
const isGuest = (req, res, next) => {
    if (req.session.user) {
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        }
        return res.redirect('/member/dashboard');
    }
    next();
};

module.exports = {
    isLoggedIn,
    isAdmin,
    isMember,
    isApprovedMember,
    isGuest
};
