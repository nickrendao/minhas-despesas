# Respostas sugeridas: "Segurança dos dados" e outros formulários da Play Console

> São **sugestões** baseadas no que o app realmente faz hoje. A Play pode mudar as perguntas: leia cada uma com calma e responda com a verdade. Se o app mudar (anúncios, contas, analytics), **refaça** estas respostas.

## Fatos do app (a base de tudo)
- Sem conta, sem login, sem servidor do desenvolvedor, sem anúncios, sem SDKs de terceiros, sem analytics.
- Dados do usuário só no aparelho (armazenamento privado do app).
- Única permissão: INTERNET. Única conexão: `api.coingecko.com` (HTTPS) para cotações, com os identificadores das moedas e o IP do aparelho.
- Backup automático do Android ligado apenas para as preferências `minhas_despesas.xml` (cópia dos dados do usuário, sob as regras do Google).
- "Apagar todos os dados" dentro do app; desinstalar também apaga.

## Segurança dos dados (Data safety)
| Pergunta | Resposta sugerida |
|---|---|
| O app coleta ou compartilha dados do usuário? | **Sim**, por causa da conexão com a CoinGecko (ver abaixo). Se você entender que o IP e os identificadores de moedas, enviados de forma transitória a um serviço de terceiros, não contam como coleta, a Play permite "Não" — **recomendo ser conservador** e declarar. |
| Tipos de dados (se declarar) | **Outros dados do app**/"Atividade no app": identificadores das moedas consultadas. O endereço IP é recebido por qualquer servidor ao conectar; avalie se a Play pede para declará-lo no seu formulário. |
| Compartilhado com terceiros? | Sim: CoinGecko (prestador de serviço), **para a funcionalidade do app**. |
| Finalidade | Funcionalidade do app (cotações). Nunca publicidade, análise ou marketing. |
| O usuário pode escolher não fornecer? | Sim: é só não abrir a tela "Cripto"/não cadastrar moedas. |
| Dados criptografados em trânsito? | **Sim** (HTTPS). |
| O usuário pode pedir exclusão dos dados? | **Sim**: "Apagar todos os dados" no app ou desinstalar. Sem conta, não há dados no servidor. |
| Seguiu a política de Famílias? | Não se aplica (público: adultos). |

## Outras declarações
| Formulário | Resposta sugerida |
|---|---|
| **Política de privacidade** | URL do GitHub Pages: `.../privacidade/` |
| **Acesso ao app** | Todas as funções disponíveis sem login. |
| **Anúncios** | Não contém anúncios. |
| **Público-alvo** | **18 anos ou mais** (app financeiro, não direcionado a crianças). |
| **Classificação de conteúdo** | Categoria "utilitário/produtividade"; sem violência, sexo, drogas, jogos de azar, conteúdo gerado por usuários ou compartilhamento de localização. Resultado esperado: livre. |
| **Recursos financeiros** | O app é um **organizador pessoal**: não movimenta dinheiro, não concede crédito, não negocia ativos, não dá recomendação de investimento. A tela de cripto só mostra cotação e rendimento calculado a partir do que o usuário digitou. Escolha, na lista da Play, a opção que **descreva isso** (ou "nenhum dos recursos financeiros", se for o caso) e leia as definições com atenção. |
| **Aplicativo de governo / notícias / saúde / COVID** | Não. |
| **Conteúdo de criptomoedas** | Apenas cotação informativa, sem compra, venda, carteira ou corretagem. |
| **Compras no app / assinaturas** | Nenhuma. **O app não tem doações nem Pix.** |
| **ID de publicidade** | Não usa. |

## Quando refazer
Qualquer mudança que adicione: conta/login, anúncios, analytics, novas conexões de rede, novas permissões ou cobrança.
