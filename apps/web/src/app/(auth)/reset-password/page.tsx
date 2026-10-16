import { AuthShell } from '@/components/AuthShell';
import { ResetForm } from '@/components/ResetForm';
export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return token ? <ResetForm token={token} /> : <AuthShell title="Link inválido" subtitle="Peça um novo em “Esqueci minha senha”." />;
}
