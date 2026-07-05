const os = require('os');
const db = require('../config/database');

const WORKER_ID = `${os.hostname()}-${process.pid}`;
let readyPromise = null;

function stringify(value) {
    return JSON.stringify(value || []);
}

function parseJson(value, fallback) {
    if (!value) return fallback;
    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (error) {
        return fallback;
    }
}

async function ensureTables() {
    if (!readyPromise) {
        readyPromise = (async () => {
            await db.query(`
                CREATE TABLE IF NOT EXISTS background_jobs (
                    id VARCHAR(100) PRIMARY KEY,
                    type VARCHAR(50) NOT NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'queued',
                    options_json LONGTEXT NOT NULL,
                    result_json LONGTEXT NULL,
                    errors_json LONGTEXT NULL,
                    total INT DEFAULT 0,
                    matching_total INT DEFAULT 0,
                    scanned INT DEFAULT 0,
                    processed INT DEFAULT 0,
                    generated_count INT DEFAULT 0,
                    reused_count INT DEFAULT 0,
                    skipped INT DEFAULT 0,
                    failed_count INT DEFAULT 0,
                    pages INT DEFAULT 0,
                    current_message VARCHAR(500) NULL,
                    current_member VARCHAR(255) NULL,
                    last_processed_user_id INT DEFAULT 0,
                    created_by INT NULL,
                    locked_by VARCHAR(120) NULL,
                    locked_until DATETIME NULL,
                    started_at DATETIME NULL,
                    completed_at DATETIME NULL,
                    failed_at DATETIME NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_type_status (type, status),
                    INDEX idx_created_at (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
        })();
    }

    return readyPromise;
}

function normalize(row) {
    if (!row) return null;

    const options = parseJson(row.options_json, {});
    const result = parseJson(row.result_json, {});
    const errors = parseJson(row.errors_json, []);

    return {
        id: row.id,
        type: row.type,
        status: row.status,
        options,
        result,
        errors,
        total: row.total || 0,
        matchingTotal: row.matching_total || 0,
        scanned: row.scanned || 0,
        processed: row.processed || 0,
        generated: row.generated_count || 0,
        reused: row.reused_count || 0,
        skipped: row.skipped || 0,
        failed: row.failed_count || 0,
        pages: row.pages || 0,
        message: row.current_message || '',
        currentMember: row.current_member || null,
        lastProcessedUserId: row.last_processed_user_id || 0,
        requestedBy: row.created_by || null,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        failedAt: row.failed_at,
        fileName: result.fileName || null,
        filePath: result.filePath || null,
        downloadUrl: result.downloadUrl || null,
        files: result.files || []
    };
}

async function createJob({ id, type, options, createdBy, message }) {
    await ensureTables();
    await db.query(
        `INSERT INTO background_jobs (id, type, status, options_json, result_json, errors_json, created_by, current_message)
         VALUES (?, ?, 'queued', ?, ?, ?, ?, ?)`,
        [id, type, stringify(options || {}), stringify({}), stringify([]), createdBy || null, message || 'Menunggu giliran...']
    );
    return getJob(id);
}

async function getJob(id) {
    await ensureTables();
    const [rows] = await db.query('SELECT * FROM background_jobs WHERE id = ? LIMIT 1', [id]);
    return normalize(rows[0]);
}

async function getRecentJobs(type, limit = 10) {
    await ensureTables();
    const [rows] = await db.query(
        'SELECT * FROM background_jobs WHERE type = ? ORDER BY created_at DESC LIMIT ?',
        [type, limit]
    );
    return rows.map(normalize);
}

async function getPendingJobs(type, limit = 20) {
    await ensureTables();
    const [rows] = await db.query(
        `SELECT * FROM background_jobs
         WHERE type = ? AND status = 'queued'
         ORDER BY created_at ASC
         LIMIT ?`,
        [type, limit]
    );
    return rows.map(normalize);
}

async function requeueInterrupted(type) {
    await ensureTables();
    await db.query(
        `UPDATE background_jobs
         SET status = 'queued', locked_by = NULL, locked_until = NULL,
             current_message = 'Pekerjaan sempat terhenti dan akan dilanjutkan otomatis.'
         WHERE type = ? AND status = 'processing'`,
        [type]
    );
}

async function claimJob(id, type) {
    await ensureTables();
    const [result] = await db.query(
        `UPDATE background_jobs
         SET status = 'processing',
             started_at = COALESCE(started_at, NOW()),
             locked_by = ?,
             locked_until = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
         WHERE id = ? AND type = ? AND status IN ('queued', 'processing')`,
        [WORKER_ID, id, type]
    );

    return result.affectedRows > 0 ? getJob(id) : null;
}

async function updateJob(id, fields) {
    await ensureTables();
    const map = {
        status: 'status',
        total: 'total',
        matchingTotal: 'matching_total',
        scanned: 'scanned',
        processed: 'processed',
        generated: 'generated_count',
        reused: 'reused_count',
        skipped: 'skipped',
        failed: 'failed_count',
        pages: 'pages',
        message: 'current_message',
        currentMember: 'current_member',
        lastProcessedUserId: 'last_processed_user_id',
        startedAt: 'started_at',
        completedAt: 'completed_at',
        failedAt: 'failed_at'
    };

    const sets = [];
    const values = [];

    Object.entries(fields).forEach(([key, value]) => {
        if (key === 'result') {
            sets.push('result_json = ?');
            values.push(stringify(value || {}));
            return;
        }

        if (key === 'errors') {
            sets.push('errors_json = ?');
            values.push(stringify(value || []));
            return;
        }

        if (!map[key]) return;
        sets.push(`${map[key]} = ?`);
        values.push(value);
    });

    if (sets.length === 0) return getJob(id);

    values.push(id);
    await db.query(`UPDATE background_jobs SET ${sets.join(', ')} WHERE id = ?`, values);
    return getJob(id);
}

async function addError(id, error) {
    const job = await getJob(id);
    if (!job) return null;

    const errors = [...(job.errors || []), error].slice(-50);
    return updateJob(id, { errors });
}

function toPublicJob(job) {
    if (!job) return null;

    const safeFiles = (job.files || []).map(file => ({
        fileName: file.fileName,
        downloadUrl: file.downloadUrl,
        memberCount: file.memberCount,
        pages: file.pages
    }));

    return {
        ...job,
        filePath: undefined,
        files: safeFiles
    };
}

module.exports = {
    ensureTables,
    createJob,
    getJob,
    getRecentJobs,
    getPendingJobs,
    requeueInterrupted,
    claimJob,
    updateJob,
    addError,
    toPublicJob
};
