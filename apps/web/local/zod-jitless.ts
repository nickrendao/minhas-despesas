import { z } from 'zod';
/**
 * O app é publicado com política de segurança SEM 'unsafe-eval'. Por padrão o Zod testa se pode gerar código na hora (new Function) e uma política estrita
 * registra essa sondagem como violação. Em modo "jitless" ele nem tenta: a validação fica um pouco mais lenta (irrelevante num app pessoal).
 * IMPORTANTE: o Zod decide isso quando cada esquema é CRIADO, então este módulo precisa ser o PRIMEIRO a carregar (antes de @fin/shared).
 */
z.config({ jitless: true });
