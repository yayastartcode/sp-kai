const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
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

/**
 * Generate letter HTML for member registration
 * @param {Object} member - Member data
 * @param {string} type - 'pendaftaran' or 'kuasa'
 * @param {string} baseUrl - Base URL for assets (optional)
 * @returns {Promise<string>} - HTML content
 */
async function generateLetterHTML(member, type, baseUrl = '') {
    const templatePath = path.join(__dirname, '..', 'views', 'letters', `letter-${type}.ejs`);

    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template ${type} tidak ditemukan`);
    }

    // Get site settings for logo
    const settings = await getSettings();

    // Format tanggal lahir
    const tanggalLahir = member.tanggal_lahir
        ? new Date(member.tanggal_lahir).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';

    // Format tempat tanggal lahir
    const tempatTanggalLahir = `${member.tempat_lahir || '-'}, ${tanggalLahir}`;

    // Current date
    const now = new Date();
    const today = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    // Day name in Indonesian
    const hariNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = hariNames[now.getDay()];

    // Resolve logo paths - use base64 for local files when generating PDF
    let logoSpkai = settings.logo_image || '/images/logo-spkai.png';
    let logoBumnira = '/images/bumnira.png';

    // If baseUrl provided (PDF generation), convert local logos to base64
    if (baseUrl) {
        // Convert bumnira logo to base64
        const bumniraPath = path.join(__dirname, '..', 'public', 'images', 'bumnira.png');
        if (fs.existsSync(bumniraPath)) {
            const bumniraBuffer = fs.readFileSync(bumniraPath);
            logoBumnira = `data:image/png;base64,${bumniraBuffer.toString('base64')}`;
        }

        // Convert SP-KAI logo to base64 if it's a local path
        if (settings.logo_image && settings.logo_image.startsWith('/')) {
            const spkaiPath = path.join(__dirname, '..', 'public', settings.logo_image);
            if (fs.existsSync(spkaiPath)) {
                const spkaiBuffer = fs.readFileSync(spkaiPath);
                const ext = path.extname(spkaiPath).toLowerCase();
                const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
                logoSpkai = `data:${mimeType};base64,${spkaiBuffer.toString('base64')}`;
            }
        } else {
            logoSpkai = baseUrl + (settings.logo_image || '/images/logo-spkai.png');
        }
    }

    const data = {
        member: {
            ...member,
            tempat_tanggal_lahir: tempatTanggalLahir,
            tanggal_lahir_formatted: tanggalLahir,
            unit_kerja: member.asal || '-'  // Use asal column
        },
        today,
        hariIni,
        logoSpkai,
        logoBumnira,
        contributionText: member.contribution_type === 'transfer'
            ? 'melalui transfer ke Rekening DPPP SP-KAI'
            : 'yang pemotongannya dilakukan oleh Perusahaan dan/atau melalui bank'
    };

    const html = await ejs.renderFile(templatePath, data);
    return html;
}

/**
 * Generate letter as PDF buffer
 * @param {Object} member - Member data
 * @param {string} type - 'pendaftaran' or 'kuasa'
 * @param {string} baseUrl - Base URL for assets
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateLetterPDF(member, type, baseUrl) {
    const puppeteer = require('puppeteer');

    // Generate HTML with absolute URLs
    const html = await generateLetterHTML(member, type, baseUrl);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set content
        await page.setContent(html, { waitUntil: 'networkidle0' });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
            printBackground: true
        });

        return pdfBuffer;
    } finally {
        await browser.close();
    }
}

/**
 * Get letters needed based on contribution type
 * @param {string} contributionType - 'transfer' or 'salary_deduction'
 * @returns {Array} - Array of letter types needed
 */
function getRequiredLetters(contributionType) {
    if (contributionType === 'transfer') {
        return ['pendaftaran'];
    } else {
        return ['pendaftaran', 'kuasa'];
    }
}

module.exports = {
    generateLetterHTML,
    generateLetterPDF,
    getRequiredLetters
};
