import * as bcrypt from 'bcryptjs';
import { PasswordService } from '../src/auth/password.service';

describe('PasswordService', () => {
  const s = new PasswordService();
  it('scrypt: hash diferente a cada vez, verifica certo e errado', async () => {
    const a = await s.hash('minha-senha-123'); const b = await s.hash('minha-senha-123');
    expect(a).not.toBe(b);                       // sal aleatório
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(await s.verify('minha-senha-123', a, 'scrypt')).toBe(true);
    expect(await s.verify('minha-senha-124', a, 'scrypt')).toBe(false);
    expect(a).not.toContain('minha-senha');       // nunca texto puro
  });
  it('bcrypt legado (hash do Supabase Auth) é aceito e marcado para migrar', async () => {
    const legacy = bcrypt.hashSync('senha-antiga', 10);
    expect(await s.verify('senha-antiga', legacy, 'bcrypt')).toBe(true);
    expect(await s.verify('outra', legacy, 'bcrypt')).toBe(false);
    expect(s.needsRehash('bcrypt')).toBe(true);
    expect(s.needsRehash('scrypt')).toBe(false);
  });
  it('hash malformado nunca autentica (e não lança exceção)', async () => {
    expect(await s.verify('x', 'lixo', 'scrypt')).toBe(false);
  });
});
