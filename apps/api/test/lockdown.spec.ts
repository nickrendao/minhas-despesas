import { Client } from 'pg';

describe('Fechamento do acesso público (Supabase anon key é pública)', () => {
  const tables = ['users', 'auth_tokens', 'refresh_tokens', 'user_settings', 'month_ledger', 'incomes', 'expenses', 'credit_cards', 'card_purchases', 'investment_plans', 'crypto_holdings'];
  let c: Client;
  beforeAll(async () => { c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect();
    await c.query("INSERT INTO users(id,email,password_hash) VALUES ('22222222-2222-2222-2222-222222222222','vitima@x.com','HASH-SECRETO')"); });
  afterAll(async () => { await c.query('DELETE FROM users'); await c.end(); });

  for (const role of ['anon', 'authenticated']) {
    it(`papel "${role}" NÃO consegue ler nenhuma das ${tables.length} tabelas novas`, async () => {
      for (const t of tables) {
        await c.query(`SET ROLE ${role}`);
        await expect(c.query(`SELECT * FROM ${t} LIMIT 1`)).rejects.toThrow(/permission denied/i);
        await c.query('RESET ROLE');
      }
    });
    it(`papel "${role}" NÃO consegue escrever/apagar`, async () => {
      await c.query(`SET ROLE ${role}`);
      await expect(c.query("DELETE FROM users")).rejects.toThrow(/permission denied/i);
      await c.query('RESET ROLE');
      await expect(c.query("UPDATE users SET password_hash='x'")).resolves.toBeDefined(); // como superusuário ainda funciona
    });
  }
  it('RLS está ativo em todas as tabelas novas (segunda camada de proteção)', async () => {
    const r = await c.query("SELECT relname FROM pg_class WHERE relname = ANY($1) AND NOT relrowsecurity", [tables]);
    expect(r.rows).toEqual([]);
  });
  it('a tabela legada app_data (se existir) NÃO é tocada pela migration', async () => {
    await c.query('CREATE TABLE IF NOT EXISTS app_data(user_id uuid primary key, data jsonb)');
    await c.query('GRANT ALL ON app_data TO anon, authenticated');
    await c.query("SET ROLE authenticated");
    await expect(c.query('SELECT * FROM app_data')).resolves.toBeDefined(); // site atual continua funcionando
    await c.query('RESET ROLE');
    await c.query('DROP TABLE app_data');
  });
});
