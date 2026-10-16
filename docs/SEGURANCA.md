# Segurança

## ✅ Implementado e testado
| Risco | Proteção | Teste |
|---|---|---|
| Ver/alterar dados de outro usuário | Todo acesso filtra por `userId` do token; 404 para recurso alheio | `resources.spec` (13 cenários) + sabotagem (3 variações detectadas) |
| **Exposição pública das tabelas novas no Supabase** (a chave `anon` é pública no HTML do site antigo) | RLS ligado + `REVOKE` para `anon`/`authenticated` | `lockdown.spec` (falha 6/6 se a migration for removida) |
| Senhas | scrypt (N=2¹⁵) com sal; bcrypt legado aceito e migrado no 1º login | `password.spec`, `auth.spec` |
| Roubo de sessão | Access JWT 15 min; refresh opaco, **só o hash** no banco, rotativo, **reuso derruba a família** | `auth.spec` |
| Enumeração de contas | Cadastro/recuperação respondem igual exista ou não o e-mail; login equaliza o tempo | `auth.spec` |
| Força bruta | Rate limit global + 10/min em login, cadastro, refresh, PIN | `crypto-security.spec` (429) |
| Mass assignment | Zod `.strict()` nos PATCH; dono sempre vem do token | `resources.spec` |
| SQL injection | Prisma parametrizado | teste de `'; DROP TABLE` |
| Valores inválidos | Zod na API **e** `CHECK` no banco (inteiro, ≥0, ≤R$20 mi, mês válido…) | `resources.spec` + checks diretos no banco |
| Vazamento em erros | Filtro global: formato único, sem stack/SQL | `crypto-security.spec` |
| Cabeçalhos | Helmet (HSTS, nosniff, CSP…), CORS por lista, `x-powered-by` removido | `crypto-security.spec` |
| Segredos | Validados no boot; `.env` ignorado no Git; Swagger desligado em produção | fumaça em modo produção |
| LGPD | `GET /me/export` (portabilidade); `delete-account` com senha apaga tudo em cascata | `auth.spec`, `resources.spec` |

## ⚠️ Riscos residuais — leia antes de publicar
1. **PIN de privacidade (4–6 dígitos) NÃO é segurança forte.** Mesmo em hash, 10⁶ combinações caem em segundos se o banco vazar. É trava de "olhadinha" na tela, como já era. Não proteja nada crítico com ele.
2. **Refresh token duplo legítimo:** se um cliente disparar dois `refresh` simultâneos com o mesmo token, o segundo é tratado como reuso e a sessão cai. **Mitigado no `@fin/api-client`**, que compartilha uma única renovação entre chamadas simultâneas (testado com 10 em paralelo; a sabotagem do mecanismo é detectada). Clientes que NÃO usarem o `api-client` precisam fazer o mesmo.
3. **Sessão no site (implementado e testado):** o refresh token fica em cookie `httpOnly` + `SameSite=Lax` (+ `Secure` em HTTPS), restrito a `/api/auth`, gerido pelo servidor do site (BFF); o navegador só guarda o access token (15 min) na memória. POSTs de login/refresh/logout/trocar senha/excluir conta só são aceitos se vierem do próprio site (CSRF), conferindo, em ordem: `Origin` → `Sec-Fetch-Site: same-origin` → `Referer`; sem sinal algum, recusa. *(Achado em teste no Chrome: em chamadas do mesmo site o navegador pode não enviar `Origin`; a versão que só olhava `Origin` recusava todo login real.)* **Não verificado:** o comportamento atrás do proxy de uma hospedagem real — defina `WEB_ORIGINS` explicitamente em produção. O access token em memória ainda é legível por um XSS durante seus 15 minutos, e **não há Content-Security-Policy configurada no site** ainda (o Next envia só cabeçalhos básicos).
4. **E-mail:** sem `SMTP_URL` configurado a confirmação/recuperação só imprime no log. Precisa de um provedor SMTP (existem planos gratuitos — confira limites atuais). Testei o envio contra um servidor SMTP **local simulado**, não contra um provedor real (TLS, autenticação e entregabilidade/SPF/DKIM não foram testados).
5. **Rate limit em memória:** vale por instância. Com mais de uma instância da API, use um store compartilhado (Redis).
6. **Sem 2FA, sem bloqueio de conta por tentativas** (só limite por IP), **sem auditoria de acessos**.
7. **Cotações CoinGecko:** API gratuita pode mudar limites/exigir chave; a API degrada com elegância ("sem cotação"), mas não pude chamar o serviço real do meu ambiente.
8. **Dependências (`npm audit`) — verificado:**
   - O `nodemailer` 7 tinha 7 vulnerabilidades (5 altas, algumas de validação de destinatário). **Atualizado para a v10** e testado enviando um e-mail real a um servidor SMTP local.
   - Restam 6 avisos, **todos em ferramentas, não no código que atende usuários**: `prisma` (CLI) → `mysql2`/`deepmerge-ts`, e `@nestjs/swagger` → `js-yaml`.
     Medi o que a API carrega ao subir em modo produção: `mysql2`, `deepmerge-ts` e o CLI do Prisma **não são carregados**; `js-yaml` é carregado apenas pelo Swagger, que fica desligado em produção e nunca lê YAML vindo de usuários.
   - As correções que o `npm audit` sugere são *downgrade* do Prisma (6.x) ou Swagger 12 (exige Nest 12) — piores que o risco. **Reavalie a cada atualização**: rode `npm audit` e este mesmo teste de carregamento.

## Checklist de produção
- [ ] `JWT_ACCESS_SECRET` aleatório (48+ bytes) e diferente por ambiente
- [ ] `CORS_ORIGINS` só com o domínio do site
- [ ] `REQUIRE_EMAIL_VERIFICATION=true` e SMTP funcionando
- [ ] Migrations aplicadas (inclui o *lockdown*) e `SELECT` como `anon` negado (rode o `lockdown.spec` contra um banco de homologação)
- [ ] Backup do Supabase feito; teste de restauração
- [ ] HTTPS obrigatório na hospedagem; `TRUST_PROXY` correto
- [ ] Após a virada: **revogar a chave `anon`/desligar o site antigo** (ela está pública no HTML e dá acesso à `app_data`)
