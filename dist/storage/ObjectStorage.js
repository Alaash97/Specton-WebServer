"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinioObjectStorage = exports.MemoryObjectStorage = void 0;
exports.createObjectStorage = createObjectStorage;
exports.buildPublicObjectUrl = buildPublicObjectUrl;
const minio_1 = require("minio");
class MemoryObjectStorage {
    constructor() {
        this.enabled = false;
        this.directPublicReads = false;
        this.assets = new Map();
    }
    async put(key, mimeType, data) {
        this.assets.set(key, { mimeType, data });
    }
    async get(key) {
        return this.assets.get(key) ?? null;
    }
    async getDownloadUrl(_key) {
        return null;
    }
    async deletePrefix(prefix) {
        for (const key of this.assets.keys()) {
            if (key.startsWith(prefix))
                this.assets.delete(key);
        }
    }
}
exports.MemoryObjectStorage = MemoryObjectStorage;
class MinioObjectStorage {
    constructor() {
        this.enabled = true;
        const endPoint = requireEnv('MINIO_ENDPOINT');
        this.bucket = requireEnv('MINIO_BUCKET');
        this.publicBaseUrl = process.env.MINIO_PUBLIC_BASE_URL?.replace(/\/+$/, '') || undefined;
        this.directPublicReads = parseBool(process.env.MINIO_PUBLIC_READS, false);
        this.client = new minio_1.Client({
            endPoint,
            port: parseOptionalInt(process.env.MINIO_PORT),
            useSSL: parseBool(process.env.MINIO_USE_SSL, false),
            accessKey: requireEnv('MINIO_ACCESS_KEY'),
            secretKey: requireEnv('MINIO_SECRET_KEY'),
            region: process.env.MINIO_REGION || undefined,
        });
    }
    async put(key, mimeType, data) {
        await this.ensureBucket();
        await this.client.putObject(this.bucket, key, data, data.length, {
            'Content-Type': mimeType,
            'Cache-Control': 'public, max-age=86400, immutable',
        });
    }
    async get(key) {
        try {
            const stream = await this.client.getObject(this.bucket, key);
            return {
                mimeType: mimeTypeFromPath(key),
                data: await streamToBuffer(stream),
            };
        }
        catch (error) {
            if (error?.code === 'NoSuchKey' || error?.code === 'NotFound')
                return null;
            throw error;
        }
    }
    async getDownloadUrl(key) {
        if (this.directPublicReads && this.publicBaseUrl) {
            return buildPublicObjectUrl(this, key);
        }
        await this.ensureBucket();
        const expirySeconds = Math.max(60, parseInt(process.env.MINIO_PRESIGNED_GET_EXPIRY_SECONDS || '300', 10));
        return this.client.presignedGetObject(this.bucket, key, expirySeconds);
    }
    async deletePrefix(prefix) {
        const objects = [];
        await new Promise((resolve, reject) => {
            const stream = this.client.listObjectsV2(this.bucket, prefix, true);
            stream.on('data', (obj) => {
                if (obj.name)
                    objects.push(obj.name);
            });
            stream.on('error', reject);
            stream.on('end', resolve);
        });
        for (let i = 0; i < objects.length; i += 1000) {
            await this.client.removeObjects(this.bucket, objects.slice(i, i + 1000));
        }
    }
    async ensureBucket() {
        if (!(await this.client.bucketExists(this.bucket))) {
            await this.client.makeBucket(this.bucket, process.env.MINIO_REGION || undefined);
        }
    }
}
exports.MinioObjectStorage = MinioObjectStorage;
function createObjectStorage() {
    if (!process.env.MINIO_ENDPOINT) {
        console.log('[Storage] MINIO_ENDPOINT not set. Using in-memory session asset storage.');
        return new MemoryObjectStorage();
    }
    const storage = new MinioObjectStorage();
    const readMode = storage.directPublicReads
        ? `public reads via ${storage.publicBaseUrl ?? '(missing MINIO_PUBLIC_BASE_URL)'}`
        : 'private reads via server gateway/presigned URLs';
    console.log(`[Storage] Using MinIO bucket "${process.env.MINIO_BUCKET}" at ${process.env.MINIO_ENDPOINT}; ${readMode}.`);
    return storage;
}
function buildPublicObjectUrl(storage, key) {
    if (!storage.publicBaseUrl)
        return null;
    const normalizedBase = storage.publicBaseUrl.replace(/\/+$/, '');
    const normalizedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${normalizedBase}/${normalizedKey}`;
}
function requireEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`${name} is required when MINIO_ENDPOINT is configured.`);
    return value;
}
function parseOptionalInt(value) {
    if (!value)
        return undefined;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function parseBool(value, fallback) {
    if (!value)
        return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}
async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}
function mimeTypeFromPath(path) {
    const lower = path.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
        return 'image/jpeg';
    if (lower.endsWith('.png'))
        return 'image/png';
    if (lower.endsWith('.webp'))
        return 'image/webp';
    return 'application/octet-stream';
}
//# sourceMappingURL=ObjectStorage.js.map