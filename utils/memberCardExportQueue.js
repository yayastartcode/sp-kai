const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const db = require('../config/database');
const jobStore = require('./cardJobStore');

const TYPE = 'export_cards';
const exportDir = path.join(__dirname, '..', 'public', 'uploads', 'card-exports');
const publicDir = path.join(__dirname, '..', 'public');
const queue = [];

let isProcessing = false;
let initPromise = null;

const DEFAULT_BATCH_SIZE = 12;
const MAX_BATCH_SIZE = 25;
const MEMBER_DELAY_MS = 25;
const BATCH_DELAY_MS = 350;
const EXPORT_RETENTION_DAYS = 7;

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PAGE_WIDTH_PX = 1240;
const PAGE_HEIGHT_PX = 1754;
const CARDS_PER_PAGE = 4;

function ensureExportDir() {
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeStatus(status) {
    return ['all', 'approved', 'pending', 'rejected'].includes(status) ? status : 'all';
}

function sanitizeContribution(contribution) {
    return ['transfer', 'salary_deduction'].includes(contribution) ? contribution : '';
}

function sanitizeBatchSize(batchSize) {
    const parsed = parseInt(batchSize, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH_SIZE;
    return Math.min(parsed, MAX_BATCH_SIZE);
}

function sanitizeExportLimit(exportLimit) {
    const parsed = parseInt(exportLimit, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.min(parsed, 10000);
}

function sanitizeSplitPerFile(splitPerFile) {
    const parsed = parseInt(splitPerFile, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.min(parsed, 2000);
}

function createJobId() {
    return `card-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildMemberFilter(options = {}, alias = '') {
    const prefix = alias ? `${alias}.` : '';
    const where = [`${prefix}role = ?`];
    const params = ['member'];

    if (options.status && options.status !== 'all') {
        where.push(`${prefix}status = ?`);
        params.push(options.status);
    }

    if (options.contribution) {
        where.push(`${prefix}contribution_type = ?`);
        params.push(options.contribution);
    }

    if (options.search) {
        where.push(`(${prefix}name LIKE ? OR ${prefix}nipp LIKE ? OR ${prefix}nias LIKE ?)`);
        const searchTerm = `%${options.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }

    return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

function buildReadyCardQuery(options = {}) {
    const { whereSql, params } = buildMemberFilter(options, 'u');

    return {
        fromSql: `
            FROM users u
            JOIN (
                SELECT user_id, MAX(id) as latest_card_id
                FROM member_cards
                WHERE card_image IS NOT NULL
                  AND card_image_back IS NOT NULL
                  AND card_image LIKE '%.png'
                  AND card_image_back LIKE '%.png'
                GROUP BY user_id
            ) latest_cards ON latest_cards.user_id = u.id
            JOIN member_cards mc ON mc.id = latest_cards.latest_card_id
            ${whereSql}
        `,
        params
    };
}

function publicPathToAbsolute(publicPath) {
    if (!publicPath) return null;
    const cleanPath = publicPath.startsWith('/') ? publicPath.slice(1) : publicPath;
    return path.join(publicDir, cleanPath);
}

function fileExists(filePath) {
    return Boolean(filePath && fs.existsSync(filePath));
}

function getExistingCardPaths(member) {
    const frontPath = publicPathToAbsolute(member.export_card_front || member.card_image);
    const backPath = publicPathToAbsolute(member.export_card_back || member.card_image_back);
    const missing = [];

    if (!fileExists(frontPath)) missing.push('depan');
    if (!fileExists(backPath)) missing.push('belakang');

    if (missing.length > 0) throw new Error(`File PNG kartu ${missing.join(' & ')} tidak ditemukan`);
    return { frontPath, backPath };
}

async function resizeCardForSlot(sourcePath, width, height) {
    return sharp(sourcePath)
        .resize(width, height, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .flatten({ background: '#ffffff' })
        .png()
        .toBuffer();
}

async function composeA4PageImage(entries) {
    const margin = 46;
    const gapX = 40;
    const gapY = 54;
    const cardGap = 14;
    const slotWidth = Math.floor((PAGE_WIDTH_PX - (margin * 2) - gapX) / 2);
    const slotHeight = Math.floor((PAGE_HEIGHT_PX - (margin * 2) - gapY) / 2);

    let cardWidth = Math.floor(Math.min(slotWidth, ((slotHeight - cardGap) / 2) * 1.5));
    let cardHeight = Math.floor(cardWidth / 1.5);

    if ((cardHeight * 2) + cardGap > slotHeight) {
        cardHeight = Math.floor((slotHeight - cardGap) / 2);
        cardWidth = Math.floor(cardHeight * 1.5);
    }

    const composites = [];
    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (!entry) continue;

        const col = index % 2;
        const row = Math.floor(index / 2);
        const slotX = margin + (col * (slotWidth + gapX));
        const slotY = margin + (row * (slotHeight + gapY));
        const cardX = Math.floor(slotX + ((slotWidth - cardWidth) / 2));
        const pairHeight = (cardHeight * 2) + cardGap;
        const pairY = Math.floor(slotY + ((slotHeight - pairHeight) / 2));

        const frontBuffer = await resizeCardForSlot(entry.frontPath, cardWidth, cardHeight);
        const backBuffer = await resizeCardForSlot(entry.backPath, cardWidth, cardHeight);

        composites.push(
            { input: frontBuffer, left: cardX, top: pairY },
            { input: backBuffer, left: cardX, top: pairY + cardHeight + cardGap }
        );
    }

    return sharp({
        create: {
            width: PAGE_WIDTH_PX,
            height: PAGE_HEIGHT_PX,
            channels: 3,
            background: { r: 255, g: 255, b: 255 }
        }
    })
        .composite(composites)
        .jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true })
        .toBuffer();
}

function createPdfWriter(filePath) {
    const fd = fs.openSync(filePath, 'w');
    const offsets = [];
    let position = 0;

    function write(data) {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        fs.writeSync(fd, buffer, 0, buffer.length, position);
        position += buffer.length;
    }

    function writeObject(objectNumber, bodyParts) {
        offsets[objectNumber] = position;
        write(`${objectNumber} 0 obj\n`);
        if (Array.isArray(bodyParts)) bodyParts.forEach(part => write(part));
        else write(bodyParts);
        write('\nendobj\n');
    }

    return {
        write,
        writeObject,
        close: () => fs.closeSync(fd),
        get position() { return position; },
        get offsets() { return offsets; }
    };
}

async function writePdfFromEntries(filePath, entries, job) {
    const pageCount = Math.ceil(entries.length / CARDS_PER_PAGE);
    const maxObjectNumber = 2 + (pageCount * 3);
    const writer = createPdfWriter(filePath);

    try {
        writer.write(Buffer.from('%PDF-1.4\n%\xff\xff\xff\xff\n', 'binary'));
        writer.writeObject(1, '<< /Type /Catalog /Pages 2 0 R >>');

        const kids = [];
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) kids.push(`${3 + (pageIndex * 3)} 0 R`);
        writer.writeObject(2, `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>`);

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
            const pageObject = 3 + (pageIndex * 3);
            const imageObject = pageObject + 1;
            const contentObject = pageObject + 2;
            const imageName = `Im${pageIndex + 1}`;
            const pageEntries = entries.slice(pageIndex * CARDS_PER_PAGE, (pageIndex + 1) * CARDS_PER_PAGE);

            await jobStore.updateJob(job.id, { message: `Menyusun halaman PDF ${pageIndex + 1}/${pageCount}...` });

            const pageImage = await composeA4PageImage(pageEntries);
            const content = `q\n${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm\n/${imageName} Do\nQ\n`;

            writer.writeObject(pageObject, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] /Resources << /XObject << /${imageName} ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>`);
            writer.writeObject(imageObject, [
                `<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH_PX} /Height ${PAGE_HEIGHT_PX} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pageImage.length} >>\nstream\n`,
                pageImage,
                '\nendstream'
            ]);
            writer.writeObject(contentObject, [
                `<< /Length ${Buffer.byteLength(content)} >>\nstream\n`,
                content,
                'endstream'
            ]);
        }

        const xrefPosition = writer.position;
        writer.write(`xref\n0 ${maxObjectNumber + 1}\n`);
        writer.write('0000000000 65535 f \n');
        for (let objectNumber = 1; objectNumber <= maxObjectNumber; objectNumber += 1) {
            writer.write(`${String(writer.offsets[objectNumber]).padStart(10, '0')} 00000 n \n`);
        }
        writer.write(`trailer\n<< /Size ${maxObjectNumber + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF\n`);
    } finally {
        writer.close();
    }
}

async function renderPdf(job, entries, partNumber = 1, totalParts = 1) {
    ensureExportDir();
    const partSuffix = totalParts > 1 ? `-part-${String(partNumber).padStart(2, '0')}` : '';
    const fileName = `kartu-member-${new Date().toISOString().slice(0, 10)}-${job.id}${partSuffix}.pdf`;
    const filePath = path.join(exportDir, fileName);
    const tempPath = `${filePath}.tmp-${process.pid}`;

    await jobStore.updateJob(job.id, {
        message: totalParts > 1 ? `Membuat PDF bagian ${partNumber}/${totalParts}...` : 'Membuat PDF A4 portrait...'
    });

    try {
        await writePdfFromEntries(tempPath, entries, job);
        fs.renameSync(tempPath, filePath);
    } catch (error) {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        throw error;
    }

    return { fileName, filePath };
}

function cleanupOldExportFiles() {
    ensureExportDir();
    const cutoff = Date.now() - (EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    fs.readdirSync(exportDir).forEach(file => {
        if (!file.endsWith('.pdf') && !file.includes('.tmp-')) return;
        const filePath = path.join(exportDir, file);
        try {
            const stats = fs.statSync(filePath);
            if (stats.mtimeMs < cutoff || file.includes('.tmp-')) fs.unlinkSync(filePath);
        } catch (error) {
            console.warn('Gagal membersihkan file export lama:', error.message);
        }
    });
}

function decorateJob(job) {
    if (!job) return null;
    const done = job.processed + job.failed;
    const progress = job.total > 0 ? Math.min(100, Math.round((done / job.total) * 100)) : 0;
    return {
        ...jobStore.toPublicJob(job),
        progress,
        done
    };
}

async function persist(job, fields) {
    const updated = await jobStore.updateJob(job.id, fields);
    return decorateJob(updated);
}

async function runJob(jobId) {
    let job = await jobStore.claimJob(jobId, TYPE);
    if (!job) return;

    const entries = [];

    try {
        cleanupOldExportFiles();
        job = await persist(job, {
            status: 'processing',
            scanned: 0,
            processed: 0,
            reused: 0,
            failed: 0,
            pages: 0,
            result: {},
            errors: [],
            message: 'Mengambil data kartu yang sudah siap...'
        });

        const options = job.options || {};
        const { fromSql, params } = buildReadyCardQuery(options);
        const [countRows] = await db.query(`SELECT COUNT(*) as total ${fromSql}`, params);
        const matchingTotal = countRows[0]?.total || 0;
        const total = options.exportLimit ? Math.min(matchingTotal, options.exportLimit) : matchingTotal;
        job = await persist(job, { matchingTotal, total });

        if (total === 0) {
            await persist(job, {
                status: 'completed',
                completedAt: new Date(),
                message: 'Tidak ada kartu siap cetak sesuai pilihan.'
            });
            return;
        }

        let lastId = 0;
        let hasMore = true;
        while (hasMore && (job.processed + job.failed) < total) {
            const remaining = total - (job.processed + job.failed);
            const currentBatchSize = Math.min(options.batchSize, remaining);
            const [members] = await db.query(
                `SELECT u.*, mc.card_image AS export_card_front, mc.card_image_back AS export_card_back
                 ${fromSql}
                 AND u.id > ?
                 ORDER BY u.id ASC
                 LIMIT ?`,
                [...params, lastId, currentBatchSize]
            );

            if (members.length === 0) {
                hasMore = false;
                break;
            }

            for (const member of members) {
                if ((job.processed + job.failed) >= total) break;
                lastId = member.id;

                try {
                    const cardPaths = getExistingCardPaths(member);
                    entries.push({ member, frontPath: cardPaths.frontPath, backPath: cardPaths.backPath });
                    job = await persist(job, {
                        processed: job.processed + 1,
                        reused: job.reused + 1,
                        lastProcessedUserId: member.id,
                        message: `Menyiapkan kartu ${member.name || 'anggota'}...`,
                        currentMember: member.name
                    });
                } catch (error) {
                    await jobStore.addError(job.id, { memberId: member.id, memberName: member.name, message: error.message });
                    job = await persist(job, {
                        failed: job.failed + 1,
                        lastProcessedUserId: member.id,
                        message: `Ada kartu yang belum lengkap, lanjut ke berikutnya.`,
                        currentMember: null
                    });
                }

                await sleep(MEMBER_DELAY_MS);
            }

            if ((job.processed + job.failed) < total) await sleep(BATCH_DELAY_MS);
        }

        if (entries.length === 0) throw new Error('Tidak ada kartu depan-belakang yang bisa dibuat PDF.');

        const splitPerFile = options.splitPerFile || entries.length;
        const chunks = [];
        for (let i = 0; i < entries.length; i += splitPerFile) chunks.push(entries.slice(i, i + splitPerFile));

        const files = [];
        for (let index = 0; index < chunks.length; index += 1) {
            const pdfResult = await renderPdf(job, chunks[index], index + 1, chunks.length);
            files.push({
                fileName: pdfResult.fileName,
                filePath: pdfResult.filePath,
                downloadUrl: `/admin/members/card-export/${job.id}/download/${index}`,
                memberCount: chunks[index].length,
                pages: Math.ceil(chunks[index].length / CARDS_PER_PAGE)
            });
        }

        const result = {
            files,
            fileName: files[0]?.fileName || null,
            filePath: files[0]?.filePath || null,
            downloadUrl: files[0]?.downloadUrl || null
        };

        await persist(job, {
            status: 'completed',
            completedAt: new Date(),
            pages: Math.ceil(entries.length / CARDS_PER_PAGE),
            result,
            currentMember: null,
            message: chunks.length > 1
                ? `PDF selesai: ${entries.length} anggota, ${chunks.length} file.`
                : `PDF selesai: ${entries.length} anggota.`
        });
    } catch (error) {
        await jobStore.addError(job.id, { message: error.message });
        await persist(job, {
            status: 'failed',
            failedAt: new Date(),
            currentMember: null,
            message: 'Pembuatan PDF berhenti. Bisa diulang dari menu.'
        });
        console.error('Member card export job failed:', error);
    }
}

async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;
    try {
        await ensureInitialized();
        while (queue.length > 0) await runJob(queue.shift());
    } finally {
        isProcessing = false;
    }
}

function scheduleQueue() {
    if (!isProcessing) setImmediate(processQueue);
}

async function ensureInitialized() {
    if (!initPromise) {
        initPromise = (async () => {
            await jobStore.ensureTables();
            await jobStore.requeueInterrupted(TYPE);
            const pending = await jobStore.getPendingJobs(TYPE, 50);
            pending.forEach(job => queue.push(job.id));
            scheduleQueue();
        })();
    }
    return initPromise;
}

async function enqueue(options = {}, requestedBy = null) {
    await ensureInitialized();
    const sanitizedOptions = {
        status: sanitizeStatus(options.status || 'all'),
        contribution: sanitizeContribution(options.contribution || ''),
        search: String(options.search || '').trim(),
        batchSize: sanitizeBatchSize(options.batchSize),
        exportLimit: sanitizeExportLimit(options.exportLimit),
        splitPerFile: sanitizeSplitPerFile(options.splitPerFile)
    };

    const job = await jobStore.createJob({
        id: createJobId(),
        type: TYPE,
        options: sanitizedOptions,
        createdBy: requestedBy,
        message: 'Menunggu giliran membuat PDF...'
    });

    queue.push(job.id);
    scheduleQueue();
    return decorateJob(job);
}

async function getJob(jobId) {
    await ensureInitialized();
    return decorateJob(await jobStore.getJob(jobId));
}

async function getJobForDownload(jobId) {
    await ensureInitialized();
    return jobStore.getJob(jobId);
}

async function getRecentJobs(limit = 10) {
    await ensureInitialized();
    const jobs = await jobStore.getRecentJobs(TYPE, limit);
    return jobs.map(decorateJob);
}

ensureInitialized().catch(error => {
    console.error('Failed to initialize card export queue:', error);
});

module.exports = {
    enqueue,
    getJob,
    getJobForDownload,
    getRecentJobs
};
