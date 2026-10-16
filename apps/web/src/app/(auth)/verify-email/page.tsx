import { AuthShell } from '@/components/AuthShell';
import { VerifyEmail } from '@/components/VerifyEmail';
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return token ? <VerifyEmail token={token} /> : <AuthShell title="Link inválido" subtitle="Abra o link completo que enviamos por e-mail." />;
}
