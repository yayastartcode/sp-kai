require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const cardGeneratorCustom = require('../utils/cardGeneratorCustom');

const cardsDir = path.join(__dirname, '..', 'public', 'uploads', 'cards');
const publicDir = path.join(__dirname, '..', 'public');

function parseArgs(argv) {
    const args = {
        limit: 0,
        batch: 20,
        delay: 250,
        startId: 0,
        force: false,
        dryRun: false
    };

    argv.forEach(arg => {
        if (arg === '--force') args.force = true;
        if (arg === '--dry-run') args.dryRun = true;
        if (arg.startsWith('--limit=')) args.limit = Math.max(0, parseInt(arg.split('=')[1], 10) || 0);
        if (arg.startsWith('--batch=')) args.batch = Math.max(1, Math.min(100, parseInt(arg.split('=')[1], 10) || args.batch));
        if (arg.startsWith('--delay=')) args.delay = Math.max(0, parseInt(arg.split('=')[1], 10) || 0);
        if (arg.startsWith('--start-id=')) args.startId = Math.max(0, parseInt(arg.split('=')[1], 10) || 0);
    });

    return args;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

async function getApprovedStats() {
    const [totalRows] = await db.query("SELECT COUNT(*) as total FROM users WHERE role = 'member' AND status = 'approved'");
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

    return {
        approvedTotal: totalRows[0]?.total || 0,
        readyInDatabase: readyRows[0]?.total || 0
    };
}

async function fetchBatch(lastId, batchSize) {
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
          AND u.id > ?
        ORDER BY u.id ASC
        LIMIT ?
    `, [lastId, batchSize]);

    return members;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const settings = await getSettings();
    const stats = await getApprovedStats();

    let lastId = args.startId;
    let scanned = 0;
    let skipped = 0;
    let generated = 0;
    let failed = 0;
    let hasMore = true;
    const startedAt = Date.now();

    console.log('Generate missing approved member cards');
    console.log(`Approved members: ${stats.approvedTotal}`);
    console.log(`Ready in database: ${stats.readyInDatabase}`);
    console.log(`Mode: ${args.force ? 'force regenerate approved members' : 'generate missing only'}`);
    console.log(`Limit: ${args.limit || 'none'}, batch: ${args.batch}, delay: ${args.delay}ms, start-id: ${args.startId}`);
    if (args.dryRun) console.log('Dry run: no files/database changes will be written');
    console.log('---');

    while (hasMore) {
        if (args.limit && (generated + failed) >= args.limit) break;

        const members = await fetchBatch(lastId, args.batch);
        if (members.length === 0) {
            hasMore = false;
            break;
        }

        for (const member of members) {
            lastId = member.id;
            scanned += 1;

            if (args.limit && (generated + failed) >= args.limit) break;

            if (!args.force && hasUsableExistingCard(member)) {
                skipped += 1;
                continue;
            }

            try {
                if (args.dryRun) {
                    generated += 1;
                    console.log(`[dry-run] would generate ${member.id} - ${member.name}`);
                    continue;
                }

                const memberForCard = {
                    ...member,
                    member_id: member.member_id || `USR${member.id}`
                };

                const cardResult = await cardGeneratorCustom.generate(memberForCard, settings);
                await saveGeneratedCard(memberForCard, cardResult);
                cleanupOldCardFiles(memberForCard, cardResult);

                generated += 1;
                console.log(`[ok] ${generated}${args.limit ? `/${args.limit}` : ''} id=${member.id} ${member.name}`);
            } catch (error) {
                failed += 1;
                console.error(`[failed] id=${member.id} ${member.name}: ${error.message}`);
            }

            if (args.delay > 0) {
                await sleep(args.delay);
            }
        }
    }

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    console.log('---');
    console.log(`Done in ${durationSeconds}s`);
    console.log(`Scanned: ${scanned}`);
    console.log(`Skipped existing: ${skipped}`);
    console.log(`Generated: ${generated}`);
    console.log(`Failed: ${failed}`);
    console.log(`Last processed user id: ${lastId}`);

    if (failed > 0) {
        process.exitCode = 1;
    }
}

main()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.end();
    });
