# Regras de negócio portadas do site atual

Todas cobertas por testes (`test/finance.spec.ts`, `months-reports.spec.ts`, `resources.spec.ts`).

| Regra | Valor/Comportamento |
|---|---|
| Saldo do mês | rendas − despesas (pode ser negativo) |
| "Comprometido" | `round(despesas ÷ rendas × 100)`; 0 se não há renda |
| Fixas × variáveis | fixa = marcada "repete todo mês" |
| Meta de gastos | barra `min(100, despesas÷meta)`; mostra "ultrapassada em X" ou "faltam X" |
| Reserva de emergência | `base × meses` (3 a 12); base = despesas do mês, **ou 70% da renda** se não há despesas |
| Cartão de crédito | usado = soma das compras; disponível = limite − usado (**pode ficar negativo**); alerta a partir de **80%** (inclusive) |
| Limites | **3 rendas/mês**, **5 cartões** |
| Plano de investimento | meses até a meta = `ceil(meta ÷ aporte mensal)`; 0 se aporte = 0 |
| Cripto | investido = qtd × preço pago; atual = qtd × cotação; **total só soma posições com cotação**; % só existe se investido > 0 |
| Vencimentos | mês atual: some o que já venceu, ordena por dia, mostra 3; `hoje`/`amanhã` = urgente |
| Anual | soma **apenas meses gravados**; média = total ÷ 12; maior mês (empate = o primeiro) |
| Copiar mês | copia **tudo** (não só recorrentes) e substitui o destino (agora exige `overwrite:true` se houver dados) |

## Mudanças intencionais (decisões já CONFIRMADAS por você: recorrência única ✅ · senha mínima 6 ✅)
1. **Recorrência não "ressuscita" mais.** No site atual, a regra real era *"se o mês está vazio, preenche com as recorrentes do mês anterior"* — a cada abertura. Então apagar todas as despesas fixas de um mês e recarregar as trazia de volta. Agora a cópia acontece **uma única vez**, na primeira abertura do mês (tabela `month_ledger`). *(Na minha auditoria inicial eu descrevi essa regra de forma errada; corrigido aqui.)*
2. **Valores negativos não existem mais.** O site antigo aceitava digitar valor negativo. O banco agora proíbe (`CHECK >= 0`). Na migração, negativos viram R$ 0,00 **com aviso do valor exato** no relatório.
3. **Senha: mínimo de 6 caracteres (igual ao site atual — decisão sua).** Aviso: 6 caracteres é um mínimo fraco; as proteções contra tentativas repetidas (limite por IP) e o hash scrypt ajudam, mas senhas curtas continuam mais fáceis de adivinhar. Dá para elevar depois sem afetar quem já tem conta.
4. **Parcelas:** atual ≤ total é validado (antes qualquer combinação era aceita).
5. **Cartão de crédito:** não há "data" por compra (o site antigo também não tinha); o OFX exportado continuará usando a data do dia.
6. **Reserva:** a base fallback (70% da renda) agora é arredondada para centavos inteiros.


## Renda principal, ícone da despesa e tutorial (atualização de outubro/2026)

### Renda principal
- **Regra:** se o mês tem rendas, **exatamente UMA** é a principal. Garantido em três camadas: lógica do serviço (sob trava por pessoa+mês), índice único parcial no banco (`incomes_one_primary_per_month`) e testes de concorrência.
- A **primeira renda do mês** vira principal sozinha. Marcar outra como principal **troca** (a anterior deixa de ser) na mesma transação.
- **Não se "desmarca"** a principal (resposta `409 PRIMARY_REQUIRED`): escolhe-se outra. Isso evita mês sem principal.
- **Apagar a principal** promove a renda mais antiga que restar.
- **Recorrência e "copiar mês"** levam a marcação. Se a principal não era recorrente, a mais antiga das copiadas assume (o mês nunca fica sem principal).
- **Efeito:** a principal aparece primeiro, com selo e estrela, e no resumo do mês. **Não altera nenhum cálculo**: o total de renda, a sobra e o % comprometido continuam usando a soma de todas as rendas.
- Renomear e editar valor/recorrência não mexem na marcação.
- **Migração:** a renda mais antiga de cada mês das contas existentes vira a principal (backfill dentro da própria migration).

### Ícone e cor da despesa
- O dado guardado é a **chave de um ícone de linha** (ex.: `home`, ≤ 24 caracteres). Emojis antigos continuam aceitos e são exibidos como o ícone equivalente (ou "Geral" se não houver equivalente). Ao editar uma despesa antiga **sem trocar o ícone, nada é regravado**.
- A cor vem da paleta do produto (20 cores, `PALETTE`). Recorrência e cópia de mês levam ícone e cor.

### Tutorial de primeiro acesso
- Campo `tutorialVersion` na conta (padrão 0). O tutorial abre **uma vez** para quem tem versão menor que `TUTORIAL_VERSION` (`packages/shared/src/constants.ts`, hoje 1). Vale para **todas** as contas, inclusive as migradas do site antigo (o campo antigo `onboarded` **não** conta).
- Pular, Esc ou concluir gravam a versão atual. O "visto" fica na conta, então vale em qualquer aparelho.
- **Para mostrar o tutorial de novo a todos numa atualização futura, basta subir `TUTORIAL_VERSION`.** "Rever o tutorial" fica em Configurações.
