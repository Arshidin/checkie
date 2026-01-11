import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY_ID = 'v1';

export interface EncryptedData {
  encrypted: string;
  iv: string;
  keyId: string;
}

export function encrypt(text: string, encryptionKey: string): EncryptedData {
  const key = Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    keyId: KEY_ID,
  };
}

export function decrypt(
  encryptedData: EncryptedData,
  encryptionKey: string,
): string {
  const key = Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32));
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function encryptObject(
  obj: Record<string, any>,
  encryptionKey: string,
): EncryptedData {
  return encrypt(JSON.stringify(obj), encryptionKey);
}

export function decryptObject<T = Record<string, any>>(
  encryptedData: EncryptedData,
  encryptionKey: string,
): T {
  const decrypted = decrypt(encryptedData, encryptionKey);
  return JSON.parse(decrypted);
}
