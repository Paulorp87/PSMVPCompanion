# MVP KC — Payon Stories

Controle pessoal de KC de MVP, drops e rentabilidade (zeny por kill).

- **Personagens:** grade com os 34 personagens; cada um abre um formulário com o último KC de cada MVP.
- **Total por MVP:** total geral e quanto subiu em cada atualização semanal.
- **Drops:** registro por MVP, com a lista de drops vinda do Payon Stories Tools.
- **Rentabilidade:** valor dos drops ÷ kills do período. Preço = média das últimas 10 vendas
  (`/api/pc/history`) do item +0 sem carta; sem venda, usa o preço de NPC. Preços são buscados
  no máximo 1x por semana.

## Variáveis de ambiente

| Nome | O que é |
|---|---|
| `DATABASE_URL` | Postgres (Neon). Criada automaticamente pela integração Neon da Vercel. |
| `APP_PASSWORD` | Senha para entrar no site. Sem ela, o site fica aberto. |

O banco cria as tabelas e importa os KCs de 09/10/2026 e 16/10/2026 sozinho no primeiro acesso.

## Rodar local

```
npm install
echo "DATABASE_URL=postgres://..." > .env.local
npm run dev
```
