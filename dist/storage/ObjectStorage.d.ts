export interface StoredAsset {
    mimeType: string;
    data: Buffer;
}
export interface ObjectStorage {
    readonly enabled: boolean;
    readonly publicBaseUrl?: string;
    readonly directPublicReads: boolean;
    put(key: string, mimeType: string, data: Buffer): Promise<void>;
    get(key: string): Promise<StoredAsset | null>;
    getDownloadUrl(key: string): Promise<string | null>;
    deletePrefix(prefix: string): Promise<void>;
}
export declare class MemoryObjectStorage implements ObjectStorage {
    readonly enabled = false;
    readonly directPublicReads = false;
    private assets;
    put(key: string, mimeType: string, data: Buffer): Promise<void>;
    get(key: string): Promise<StoredAsset | null>;
    getDownloadUrl(_key: string): Promise<string | null>;
    deletePrefix(prefix: string): Promise<void>;
}
export declare class MinioObjectStorage implements ObjectStorage {
    readonly enabled = true;
    readonly publicBaseUrl?: string;
    readonly directPublicReads: boolean;
    private client;
    private bucket;
    constructor();
    put(key: string, mimeType: string, data: Buffer): Promise<void>;
    get(key: string): Promise<StoredAsset | null>;
    getDownloadUrl(key: string): Promise<string | null>;
    deletePrefix(prefix: string): Promise<void>;
    private ensureBucket;
}
export declare function createObjectStorage(): ObjectStorage;
export declare function buildPublicObjectUrl(storage: ObjectStorage, key: string): string | null;
//# sourceMappingURL=ObjectStorage.d.ts.map