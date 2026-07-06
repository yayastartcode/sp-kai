const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const cardGeneratorCustom = require('./cardGeneratorCustom');
const jobStore = require('./cardJobStore');

const TYPE = 'generate_cards';
const cardsDir = path.join(__dirname, '..', 'public', 'uploads', 'cards');
const publicDir = path.join(__dirname, '..', 'public');
const queue = [];

let isProcessing = false;
let initPromise = null;

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;
const DEFAULT_DELAY_MS = 250;
const MAX_DELAY_MS = 5000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeBatchSize(batchSize) {
    const parsed = parseInt(batchSize, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH_SIZE;
    return Math.min(parsed, MAX_BATCH_SIZE);
}

function sanitizeLimit(limit) {
    const parsed = parseInt(limit, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.min(parsed, 10000);
}

function sanitizeDelay(delayMs) {
    const parsed = parseInt(delayMs, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_DELAY_MS;
    return Math.min(parsed, MAX_DELAY_MS);
}

function sanitizeBulkIdentifiers(input) {
    if (!input) return [];
    return Array.from(new Set(String(input)
        .split(/[\s,;]+/)
        .map(item => item.trim())
        .filter(Boolean)))
        .slice(0, 4);
}

function createJobId() {
    return `card-generate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function publicPathToAbsolute(publicPath) {
    if (!publicPath) return null;
    const cleanPath = publicPath.startsWith('/') ? publicPath.slice(1) : publicPath;
    return path.join(publicDir, cleanPath);
}

function fileExists(filePath) {
    return Boolean(filePath && fs.existsSync(filePath));
}

function hasUsableExistingCard(member) {
    const frontPath = publicPathToAbsolute(member.existing_front);
    const backPath = publicPathToAbsolute(member.existing_back);
    return fileExists(frontPath) && fileExists(backPath);
}

function safeCardNumber(member) {
    return String(member.member_id || member.nias || member.nipp || `USR${member.id}`).slice(0, 20);
}

async function getSettings() {
    const [rows] = await db.query('SELECT setting_key, setting_value FROM site_settings');
    const settings = {};
    rows.forEach(row => {
        settings[row.setting_key] = row.setting_value;
    });
    return settings;
}

async function getApprovedCardStats() {
    const [approvedRows] = await db.query("SELECT COUNT(*) as total FROM users WHERE role = 'member' AND status = 'approved'");
    const [readyRows] = await db.query(`
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        JOIN member_cards mc ON mc.user_id = u.id
        WHERE u.role = 'member'
          AND u.status = 'approved'
          AND mc.card_image IS NOT NULL
          AND mc.card_image_back IS NOT NULL
          AND mc.card_image LIKE '%.png'
          AND mc.card_image_back LIKE '%.png'
    `);

    const approvedTotal = approvedRows[0]?.total || 0;
    const readyInDatabase = readyRows[0]?.total || 0;

    return {
        approvedTotal,
        readyInDatabase,
        missingApprox: Math.max(approvedTotal - readyInDatabase, 0)
    };
}

async function saveGeneratedCard(member, cardResult) {
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 1);

    const [existing] = await db.query(
        'SELECT id FROM member_cards WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
        [member.id]
    );

    if (existing.length > 0) {
        await db.query(
            `UPDATE member_cards
             SET card_number = ?, card_image = ?, card_image_back = ?, valid_from = ?, valid_until = ?
             WHERE id = ?`,
            [safeCardNumber(member), cardResult.frontImagePath, cardResult.backImagePath, validFrom, validUntil, existing[0].id]
        );
    } else {
        await db.query(
            `INSERT INTO member_cards (user_id, card_number, card_image, card_image_back, valid_from, valid_until)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [member.id, safeCardNumber(member), cardResult.frontImagePath, cardResult.backImagePath, validFrom, validUntil]
        );
    }

    await db.query('UPDATE users SET card_generated_at = NOW() WHERE id = ?', [member.id]);
}

function cleanupOldCardFiles(member, cardResult) {
    if (!member.member_id || !fs.existsSync(cardsDir)) return;

    const memberCardPrefix = `card-${member.member_id}-`;
    const keepFiles = new Set([cardResult.frontFilename, cardResult.backFilename].filter(Boolean));

    fs.readdirSync(cardsDir).forEach(file => {
        if (!file.startsWith(memberCardPrefix) || keepFiles.has(file)) return;

        try {
            fs.unlinkSync(path.join(cardsDir, file));
        } catch (error) {
            console.warn(`Warning: gagal hapus kartu lama ${file}: ${error.message}`);
        }
    });
}

function buildIdentifierFilter(identifiers) {
    if (!identifiers || identifiers.length === 0) return { sql: '', params: [] };

    return {
        sql: 'AND (u.nipp IN (?) OR u.nias IN (?) OR u.member_id IN (?))',
        params: [identifiers, identifiers, identifiers]
    };
}

async function countTargetMembers(options) {
    const identifierFilter = buildIdentifierFilter(options.bulkIdentifiers);
    const [rows] = await db.query(`
        SELECT COUNT(*) as total
        FROM users u
        WHERE u.role = 'member'
          AND u.status = 'approved'
          ${identifierFilter.sql}
    `, identifierFilter.params);

    return rows[0]?.total || 0;
}

async function fetchBatch(lastId, batchSize, options = {}) {
    const identifierFilter = buildIdentifierFilter(options.bulkIdentifiers);
    const [members] = await db.query(`
        SELECT u.*, mc.card_image AS existing_front, mc.card_image_back AS existing_back
        FROM users u
        LEFT JOIN (
            SELECT user_id, MAX(id) as latest_card_id
            FROM member_cards
            GROUP BY user_id
        ) latest_cards ON latest_cards.user_id = u.id
        LEFT JOIN member_cards mc ON mc.id = latest_cards.latest_card_id
        WHERE u.role = 'member'
          AND u.status = 'approved'
          ${identifierFilter.sql}
          AND u.id > ?
        ORDER BY u.id ASC
        LIMIT ?
    `, [...identifierFilter.params, lastId, batchSize]);

    return members;
}

function decorateJob(job) {
    if (!job) return null;

    const done = job.options.limit ? (job.generated + job.failed) : job.scanned;
    const total = job.options.limit || job.approvedTotal || job.total || 0;
    const progress = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    return {
        ...jobStore.toPublicJob(job),
        done,
        total,
        progress
    };
}

async function persistProgress(job, fields) {
    const updated = await jobStore.updateJob(job.id, fields);
    return decorateJob(updated);
}

async function runJob(jobId) {
    let job = await jobStore.claimJob(jobId, TYPE);
    if (!job) return;

    try {
        job = await persistProgress(job, {
            status: 'processing',
            message: 'Menghitung anggota yang sudah disetujui dan kartu yang sudah ada...'
        });

        const options = job.options || {};
        const settings = await getSettings();
        const stats = await getApprovedCardStats();
        const targetTotal = await countTargetMembers(options);
        const total = options.limit ? Math.min(options.limit, targetTotal) : targetTotal;

        job = await persistProgress(job, {
            total,
            matchingTotal: targetTotal,
            message: 'Mulai menyiapkan kartu anggota...',
            generated: job.generated || 0,
            skipped: job.skipped || 0,
            failed: job.failed || 0,
            scanned: job.scanned || 0
        });

        let lastId = job.lastProcessedUserId || 0;
        let hasMore = true;

        while (hasMore) {
            if (options.limit && (job.generated + job.failed) >= options.limit) break;

            const members = await fetchBatch(lastId, options.batchSize, options);
            if (members.length === 0) {
                hasMore = false;
                break;
            }

            for (const member of members) {
                if (options.limit && (job.generated + job.failed) >= options.limit) break;

                if (!options.force && hasUsableExistingCard(member)) {
                    job = await persistProgress(job, {
                        scanned: job.scanned + 1,
                        skipped: job.skipped + 1,
                        lastProcessedUserId: member.id,
                        message: `Lewati yang sudah punya kartu: ${member.name || 'anggota'}`,
                        currentMember: member.name
                    });
                    lastId = member.id;
                    continue;
                }

                try {
                    job = await persistProgress(job, {
                        message: options.dryRun ? `Simulasi siapkan kartu: ${member.name || 'anggota'}` : `Menyiapkan kartu: ${member.name || 'anggota'}`,
                        currentMember: member.name
                    });

                    if (!options.dryRun) {
                        const memberForCard = {
                            ...member,
                            member_id: member.member_id || `USR${member.id}`
                        };
                        const cardResult = await cardGeneratorCustom.generate(memberForCard, settings);
                        await saveGeneratedCard(memberForCard, cardResult);
                        cleanupOldCardFiles(memberForCard, cardResult);
                    }

                    job = await persistProgress(job, {
                        scanned: job.scanned + 1,
                        generated: job.generated + 1,
                        lastProcessedUserId: member.id,
                        message: `Berhasil menyiapkan kartu: ${member.name || 'anggota'}`,
                        currentMember: null
                    });
                } catch (error) {
                    await jobStore.addError(job.id, {
                        memberId: member.id,
                        memberName: member.name,
                        message: error.message
                    });
                    job = await persistProgress(job, {
                        scanned: job.scanned + 1,
                        failed: job.failed + 1,
                        lastProcessedUserId: member.id,
                        message: `Gagal di ${member.name || 'anggota'}, lanjut ke anggota berikutnya.`,
                        currentMember: null
                    });
                }

                lastId = member.id;
                if (options.delayMs > 0) await sleep(options.delayMs);
            }
        }

        await persistProgress(job, {
            status: 'completed',
            completedAt: new Date(),
            currentMember: null,
            message: `Selesai. Kartu disiapkan ${job.generated}, dilewati ${job.skipped}, gagal ${job.failed}.`
        });
    } catch (error) {
        await jobStore.addError(job.id, { message: error.message });
        await persistProgress(job, {
            status: 'failed',
            failedAt: new Date(),
            currentMember: null,
            message: 'Pekerjaan berhenti karena ada kendala. Bisa dilanjutkan dari daftar pekerjaan.'
        });
        console.error('Member card generation job failed:', error);
    }
}

async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        await ensureInitialized();
        while (queue.length > 0) {
            const jobId = queue.shift();
            await runJob(jobId);
        }
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
        limit: sanitizeLimit(options.limit),
        batchSize: sanitizeBatchSize(options.batchSize),
        delayMs: sanitizeDelay(options.delayMs),
        force: options.force === true || options.force === 'on' || options.force === 'true',
        dryRun: options.dryRun === true || options.dryRun === 'on' || options.dryRun === 'true',
        bulkIdentifiers: sanitizeBulkIdentifiers(options.bulkIdentifiers)
    };

    const job = await jobStore.createJob({
        id: createJobId(),
        type: TYPE,
        options: sanitizedOptions,
        createdBy: requestedBy,
        message: 'Menunggu giliran menyiapkan kartu...'
    });

    queue.push(job.id);
    scheduleQueue();

    return decorateJob(job);
}

async function getJob(jobId) {
    await ensureInitialized();
    return decorateJob(await jobStore.getJob(jobId));
}

async function getRecentJobs(limit = 10) {
    await ensureInitialized();
    const jobs = await jobStore.getRecentJobs(TYPE, limit);
    return jobs.map(decorateJob);
}

ensureInitialized().catch(error => {
    console.error('Failed to initialize card generation queue:', error);
});

module.exports = {
    enqueue,
    getJob,
    getRecentJobs,
    getApprovedCardStats
};
