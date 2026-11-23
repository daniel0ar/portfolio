const crypto = require('crypto');

const SCRYPT = { N: 2 ** 17, r: 8, p: 1, keylen: 32 };
const SESSION_SECONDS = 60 * 60 * 8;
const COOKIE_NAME = 'blog_admin';
const MAX_PASSWORD_LENGTH = 1024;

function scrypt(password, salt, params) {
    const { N, r, p, keylen } = params;
    return new Promise((resolve, reject) => {
        crypto.scrypt(password.normalize('NFKC'), salt, keylen, { N, r, p, maxmem: 256 * N * r }, (error, key) => {
            if (error) reject(error);
            else resolve(key);
        });
    });
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const key = await scrypt(password, salt, SCRYPT);
    return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password, stored) {
    if (typeof password !== 'string' || !password || password.length > MAX_PASSWORD_LENGTH) return false;
    const [scheme, N, r, p, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !hash) return false;

    const expected = Buffer.from(hash, 'base64');
    const actual = await scrypt(password, Buffer.from(salt, 'base64'), {
        N: Number(N),
        r: Number(r),
        p: Number(p),
        keylen: expected.length,
    });
    return crypto.timingSafeEqual(actual, expected);
}

function deriveKey(purpose) {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || secret.length < 32) throw new Error('ADMIN_SECRET must be at least 32 characters');
    return Buffer.from(crypto.hkdfSync('sha256', secret, 'dani3-blog-admin', purpose, 32));
}

function sign(value) {
    return crypto.createHmac('sha256', deriveKey('session')).update(value).digest('base64url');
}

function createSessionCookie() {
    const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
    const token = `${expires}.${sign(expires)}`;
    return `${COOKIE_NAME}=${token}; Path=/api/admin; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

function clearSessionCookie() {
    return `${COOKIE_NAME}=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

function isAuthenticated(req) {
    const cookies = String(req.headers.cookie || '').split(';').map((part) => part.trim());
    const cookie = cookies.find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!cookie) return false;

    const [expires, signature] = cookie.slice(COOKIE_NAME.length + 1).split('.');
    if (!/^\d+$/.test(expires || '') || !signature) return false;

    const expected = Buffer.from(sign(expires));
    const actual = Buffer.from(signature);
    return actual.length === expected.length
        && crypto.timingSafeEqual(actual, expected)
        && Number(expires) > Date.now() / 1000;
}

// Drafts live in the repository, so they are encrypted and bound to their id.
function encryptDraft(id, draft) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey('drafts'), iv);
    cipher.setAAD(Buffer.from(id));
    const data = Buffer.concat([cipher.update(JSON.stringify(draft), 'utf8'), cipher.final()]);
    return JSON.stringify({
        v: 1,
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: data.toString('base64'),
    }) + '\n';
}

function decryptDraft(id, payload) {
    const { iv, tag, data } = JSON.parse(payload);
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey('drafts'), Buffer.from(iv, 'base64'));
    decipher.setAAD(Buffer.from(id));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const text = Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
    return JSON.parse(text);
}

module.exports = {
    hashPassword,
    verifyPassword,
    createSessionCookie,
    clearSessionCookie,
    isAuthenticated,
    encryptDraft,
    decryptDraft,
};
