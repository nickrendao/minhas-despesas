import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, ScryptOptions } from 'crypto';
import * as bcrypt from 'bcryptjs';

const N = 2 ** 15, R = 8, P = 1, KEYLEN = 64;
const OPTS: ScryptOptions = { N, r: R, p: P, maxmem: 128 * N * R * 2 };

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => scryptCb(password, salt, keylen, opts, (e, k) => (e ? reject(e) : resolve(k))));
}

/**
 * Senhas novas: scrypt (memória-intensivo, nativo do Node, sem dependência nativa).
 * Senhas legadas importadas do Supabase Auth: bcrypt — verificadas e migradas para scrypt no 1º login.
 */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt, KEYLEN, OPTS);
    return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
  }

  async verify(password: string, stored: string, algo: string): Promise<boolean> {
    if (algo === 'bcrypt') return bcrypt.compare(password, stored);
    const [, n, r, p, saltB64, keyB64] = stored.split('$');
    if (!saltB64 || !keyB64) return false;
    const expected = Buffer.from(keyB64, 'base64');
    const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: +n, r: +r, p: +p, maxmem: 128 * +n * +r * 2 });
    return key.length === expected.length && timingSafeEqual(key, expected);
  }

  /** Usado para igualar o tempo de resposta quando o e-mail não existe (evita enumeração por tempo). */
  async dummyVerify(): Promise<void> {
    await scrypt('dummy', Buffer.alloc(16), KEYLEN, OPTS);
  }

  needsRehash(algo: string) { return algo !== 'scrypt'; }
}
