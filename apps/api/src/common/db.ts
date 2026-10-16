import { PrismaService } from '../prisma/prisma.service';

export type Tx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

/** Trava de nível de transação por chave: serializa "contar + inserir" e garante os limites (3 rendas, 5 cartões) sem corrida. */
export async function advisoryLock(tx: Tx, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
