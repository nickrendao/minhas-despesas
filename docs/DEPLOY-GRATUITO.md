# Publicar a API gastando R$ 0 (verifique os termos atuais de cada serviço)

Eu **não consigo confirmar preços, limites ou se um plano gratuito ainda existe** — mudam com frequência. Use este documento como roteiro e confira cada item.

## Peças necessárias
| Peça | Opções gratuitas comuns | Observação |
|---|---|---|
| Banco PostgreSQL | **Supabase** (você já tem) | Use conexão direta/Session pooler (5432) para migrations. |
| Hospedar a API (Node) | Render, Fly.io, Railway, Koyeb… | Planos grátis costumam **"dormir"** após inatividade (1ª requisição lenta) e/ou limitar horas. |
| E-mail (SMTP) | Brevo, Resend, Gmail com senha de app… | Necessário para confirmar e-mail e recuperar senha. |
| Site (Etapa 5) | Netlify/Vercel/Cloudflare Pages | Você já usa Netlify (e tem limite de créditos — considerar Cloudflare Pages, sem esse problema). |

## Passos (roteiro)
1. Criar o serviço Web apontando para este repositório (Dockerfile em `apps/api/Dockerfile`, ou *build* `npm ci && npm run build` + *start* `node apps/api/dist/main.js`).
2. Definir as variáveis de `apps/api/.env.example` no painel da hospedagem (nunca no Git).
3. Rodar `npm run db:migrate -w @fin/api` uma vez (do seu computador, com a `DATABASE_URL` direta).
4. Testar `GET https://SUA-API/api/v1/health` → `{"data":{"status":"ok"}}`.
5. Configurar monitoramento externo gratuito (ex.: ping a cada 5 min) se quiser reduzir o "sono" do plano grátis.

## Custos ocultos a considerar
- Plano gratuito do Supabase pode **pausar projetos inativos**.
- Cold start de 30–60 s no primeiro acesso em planos que dormem.
- Quando o app crescer: Redis para rate limit, mais de uma instância, backups pagos.
