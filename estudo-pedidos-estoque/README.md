# Pedidos & Estoque: projeto de estudo (React + Node.js + Java)

Projeto de estudo para praticar a integração entre três tecnologias, cada uma com um papel
bem definido. O domínio é um mini sistema de vendas: cadastro de produtos, controle de estoque
e pedidos com cálculo de preço (descontos, cupom e frete).

| Parte | Tecnologia | O que demonstra |
|-------|-----------|-----------------|
| `web-react` | React 19, Vite | Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`), formulários controlados, validação, *debounce* de busca, proteção contra respostas fora de ordem, tema claro/escuro |
| `api-node` | Node.js, Express 5, SQLite (`node:sqlite`) | API REST, camadas (rotas → serviços → banco), validação de entrada, transações, tratamento centralizado de erros, cliente HTTP com *timeout*, testes com `node:test` |
| `pricing-java` | Java 21, Spring Boot 4 | Controller REST, `record`s, Bean Validation, injeção de dependência, regra de negócio em Java puro e testes com JUnit 5 |

## Regras de negócio

**Estoque e pedidos (Node)**
- Só é possível vender produto **ativo** e com estoque suficiente.
- Confirmar um pedido baixa o estoque; **cancelar** devolve os itens.
- A baixa de estoque é condicional e acontece em **transação**: se um item falhar, nada é gravado.
- Produto que já tem pedido **não pode ser excluído** (deve ser desativado).
- O mesmo produto repetido no pedido tem as quantidades somadas.
- Se o serviço de preços estiver fora do ar, a API responde `503` e não grava nada.

**Preço (Java)**
- 5 ou mais unidades de um item: **5%** de desconto; 10 ou mais: **10%**.
- Cupom `BEMVINDO10`: 10% de desconto para compras a partir de R$ 50,00.
- Cupom `FRETEGRATIS`: frete zerado.
- Frete: R$ 19,90, grátis quando o valor após descontos chega a R$ 200,00.
- Valores sempre em **centavos** (inteiros) para evitar erros de ponto flutuante.

## Como executar

Pré-requisitos: **Node.js 22.13+**, **JDK 21+** e **Maven 3.9+**.

Abra três terminais, a partir da raiz do projeto:

```bash
# 1) Serviço de preços (Java), porta 8081
cd pricing-java
mvn spring-boot:run

# 2) API (Node), porta 3001
cd api-node
npm install
npm start

# 3) Interface (React), porta 5173
cd web-react
npm install
npm run dev
```

Acesse **http://localhost:5173**. No topo da tela, os indicadores mostram se a API Node e o
serviço Java estão no ar.

> O Node avisa que o módulo `node:sqlite` é experimental. É esperado; o banco fica em
> `api-node/data/loja.db` e é criado (com alguns produtos de exemplo) na primeira execução.

Variáveis opcionais da API Node: `PORT` (3001), `DB_FILE` (`./data/loja.db`), `PRICING_URL` (`http://localhost:8081`).

## Testes

```bash
cd api-node && npm test          # regras de estoque, transações, validação
cd pricing-java && mvn test      # regras de preço
```

## Endpoints da API Node

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Status da API e do serviço de preços |
| GET | `/api/products?search=&onlyActive=` | Lista/busca produtos |
| GET | `/api/products/:id` | Detalhe |
| POST | `/api/products` | Cria produto |
| PUT | `/api/products/:id` | Atualiza produto |
| DELETE | `/api/products/:id` | Exclui (409 se houver pedidos) |
| GET | `/api/orders` | Lista pedidos (mais recentes primeiro) |
| GET | `/api/orders/:id` | Detalhe do pedido |
| POST | `/api/orders/quote` | Orçamento (chama o serviço Java, não grava nada) |
| POST | `/api/orders` | Confirma pedido |
| POST | `/api/orders/:id/cancel` | Cancela e devolve estoque |

Exemplo:

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerName":"Maria","coupon":"BEMVINDO10","items":[{"productId":1,"quantity":2}]}'
```

Serviço Java: `POST http://localhost:8081/api/quotes` e `GET /api/health`.

## Códigos de resposta usados

`400` dados inválidos · `404` não encontrado · `409` conflito (estoque, SKU duplicado, pedido já cancelado) ·
`422` regra de negócio (produto inativo, cupom inválido) · `502`/`503` problema no serviço de preços.

## Limitações conhecidas (é um projeto de estudo)

- Sem autenticação/autorização.
- SQLite local, sem *migrations* (o esquema é criado no start).
- Sem paginação (a lista de pedidos traz os 100 mais recentes).
- Front-end sem testes automatizados e sem roteador (as abas usam estado local).

## Próximos passos possíveis

- Trocar o SQLite por PostgreSQL e adicionar migrations.
- Docker Compose para subir os três serviços juntos.
- TypeScript no front-end e na API; testes de componentes com Vitest.
- Autenticação com JWT e pedidos por usuário.
