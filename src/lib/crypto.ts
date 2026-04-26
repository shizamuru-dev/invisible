export async function generateKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
    );
}

export async function exportPublicKeyJwk(publicKey: CryptoKey): Promise<JsonWebKey> {
    return await window.crypto.subtle.exportKey("jwk", publicKey);
}

export async function importPublicKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
        "jwk", jwk,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
    );
}

export async function exportPrivateKeyJwk(privateKey: CryptoKey): Promise<JsonWebKey> {
    return await window.crypto.subtle.exportKey("jwk", privateKey);
}

export async function importPrivateKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
        "jwk", jwk,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"]
    );
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
        const end = Math.min(i + chunkSize, len);
        const chunk = bytes.subarray(i, end);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

export interface EncryptedPackage {
    ephemeralPublicKey: JsonWebKey;
    iv: number[];
    ciphertext: string | number[];
    unencrypted?: boolean;
}

export async function encryptMessage(recipientPublicKey: CryptoKey, plaintext: string): Promise<EncryptedPackage> {
    const ephemeralPair = await generateKeyPair();
    const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: recipientPublicKey },
        ephemeralPair.privateKey,
        256
    );
    const aesKey = await window.crypto.subtle.importKey(
        "raw", sharedSecret,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encoded
    );
    const ephemeralPublicJwk = await exportPublicKeyJwk(ephemeralPair.publicKey);
    return {
        ephemeralPublicKey: ephemeralPublicJwk,
        iv: Array.from(iv),
        ciphertext: arrayBufferToBase64(ciphertext)
    };
}

export async function decryptMessage(encryptedPackage: EncryptedPackage, privateKey: CryptoKey): Promise<string> {
    const ephemeralPublic = await importPublicKeyJwk(encryptedPackage.ephemeralPublicKey);
    const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: ephemeralPublic },
        privateKey,
        256
    );
    const aesKey = await window.crypto.subtle.importKey(
        "raw", sharedSecret,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
    );
    const iv = new Uint8Array(encryptedPackage.iv);
    // fallback for older messages
    const ciphertext = Array.isArray(encryptedPackage.ciphertext) 
        ? new Uint8Array(encryptedPackage.ciphertext)
        : base64ToArrayBuffer(encryptedPackage.ciphertext as string);
    const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        ciphertext
    );
    return new TextDecoder().decode(decrypted);
}

export async function encryptFile(recipientPublicKey: CryptoKey, fileBuffer: ArrayBuffer): Promise<EncryptedPackage> {
    const ephemeralPair = await generateKeyPair();
    const sharedSecret = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: recipientPublicKey },
        ephemeralPair.privateKey,
        256
    );
    const aesKey = await window.crypto.subtle.importKey(
        "raw", sharedSecret,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        fileBuffer
    );
    const ephemeralPublicJwk = await exportPublicKeyJwk(ephemeralPair.publicKey);
    return {
        ephemeralPublicKey: ephemeralPublicJwk,
        iv: Array.from(iv),
        ciphertext: arrayBufferToBase64(ciphertext)
    };
}
export interface EncryptedBackup { ciphertext: string; iv: number[]; salt: number[]; }
export async function encryptBackup(backupData: unknown, password: string): Promise<EncryptedBackup> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(backupData));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    return { ciphertext: arrayBufferToBase64(ciphertext), iv: Array.from(iv), salt: Array.from(salt) };
}
export async function decryptBackup(encryptedData: EncryptedBackup, password: string): Promise<unknown> {
    const salt = new Uint8Array(encryptedData.salt);
    const keyMaterial = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
    );
    const iv = new Uint8Array(encryptedData.iv);
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, key, base64ToArrayBuffer(encryptedData.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
}
