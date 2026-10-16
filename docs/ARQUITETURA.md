# Arquitetura e decisões

```
 Site Next.js (futuro)   App React Native (futuro)
          \                    /
           \  HTTPS + JWT     /
            v                v
        ┌──────── API NestJS ────────┐      ┌─ CoinGecko (cotações, cache 30s no servidor)
        │ Guard global JWT · Zod     │──────┤
        │ Throttler · Helmet · CORS  │
        │ Regras financeiras puras   │
        └────────────┬───────────────┘
                     │ Prisma (adapter-pg)
                     v
              PostgreSQL (Supabase, só como banco)
```

## Decisões (e por quê)
| Decisão | Motivo |
|---|---|
| **Dinheiro em centavos inteiros** | Float erra contas (`0.1+0.2≠0.3`). Centavos são exatos e cabem num INT4 (limite R$ 20 mi por item). |
| **Mês como `AAAA-MM`** | "Setembro" é setembro em qualquer fuso; evita bug de virada de mês por UTC. "Hoje" usa o fuso do usuário. |
| **Tabelas normalizadas (11)** em vez de 1 JSON por usuário | O site antigo regravava o JSON **inteiro** a cada clique: dois aparelhos ao mesmo tempo se sobrescreviam. Agora cada linha é independente. |
| **Regras no servidor** (`domain/finance.ts`, funções puras) | Site e app mobile compartilham a mesma conta; antes cada tela recalculava no navegador. |
| **Postgres do Supabase + API própria** | Pedido do projeto. Mantém os dados no mesmo lugar; a API deixa de depender do Supabase Auth/PostgREST. |
| **Auth própria (JWT curto + refresh rotativo)** | Independência do Supabase Auth. Senhas antigas (bcrypt) continuam valendo e migram para scrypt no 1º login. |
| **Zod compartilhado** | Mesma validação no servidor e (futuramente) nos formulários; o Swagger é gerado dos mesmos schemas. |
| **Trava `pg_advisory_xact_lock`** | Garante "máx. 3 rendas / 5 cartões" mesmo com requisições simultâneas (testado com 8 em paralelo). |
| **Cotações cripto no servidor** | Cache de 30 s compartilhado; usuário não é bloqueado por limite de IP; funciona igual no app mobile. |
| **NestJS 11 (não 12)** | A versão 12 é muito recente; escolhi a que conheço e que o ecossistema (Swagger/Throttler/Testing) suporta de forma estável. |
| **TypeScript 5.9 (não 7)** | Idem: compatibilidade com ts-jest/Nest. |

## Camadas
`controller` (HTTP + validação Zod) → `service` (casos de uso, transações) → `domain/finance` (regras puras, sem banco) / Prisma.
Cada consulta filtra por `userId` **vindo do token**, nunca do corpo ou da URL; recurso de outro usuário responde 404 (não vaza existência).
