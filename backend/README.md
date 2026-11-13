# Food Delivery API

CRUD backend for a food delivery system, built from the project ER diagram.

**Stack:** Node.js · TypeScript · Express 5 · PostgreSQL 16 · `pg` driver · zod (validation)

**No ORM.** The project uses no Prisma or query builder:
- every query is hand-written SQL with `$1, $2…` parameters
- multi-step operations use **transactions written by hand**: `BEGIN` → work → `COMMIT`, or `ROLLBACK` on any error
- business rules are also enforced by **PostgreSQL triggers**, so they hold even if someone bypasses the API

---

## Quick start

To run it in Docker with the frontend, see the [root README](../README.md). To run it locally:

```bash
cp .env.example .env              # edit DATABASE_URL if needed
npm install
npm run db:migrate                # create tables + triggers
npm run db:seed                   # sample data (add `-- --no-orders` for base data only)
npm run dev                       # http://localhost:3000 with auto-reload
```

If you need a database, run `docker compose up -d db` from the project root. In the container, migrations run automatically on start.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Run the API with auto-reload (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` and run the compiled build |
| `npm run typecheck` | Type-check without emitting files |
| `npm run db:migrate` | Apply pending `db/migrations/*.sql` |
| `npm run db:seed` | Clear all data and insert sample data |
| `npm run db:reset` | Drop everything, re-migrate, re-seed |

---

## Project structure

```
backend/
├── db/migrations/
│   ├── 001_schema.sql            # tables, constraints, indexes
│   └── 002_triggers.sql          # trigger functions + triggers
├── src/
│   ├── config/env.ts             # environment variables
│   ├── db/
│   │   ├── pool.ts               # pg connection pool
│   │   ├── transaction.ts        # withTransaction(): manual BEGIN / COMMIT / ROLLBACK
│   │   ├── migrate.ts            # tiny SQL migration runner (schema_migrations table)
│   │   └── seed.ts               # seed script
│   ├── types/models.ts           # row interfaces
│   ├── validators/               # zod schemas per resource (request validation)
│   ├── services/                 # all SQL lives here
│   │   ├── crud.service.ts       # generic parameterised CRUD (list/get/create/update/delete)
│   │   ├── order.service.ts      # order transactions
│   │   └── *.service.ts          # per-table config for the generic CRUD
│   ├── controllers/
│   │   ├── crud.controller.ts    # generic handlers: validate → service → JSON
│   │   └── order.controller.ts
│   ├── routes/
│   │   ├── index.ts              # mounts every resource under /api
│   │   ├── crud.routes.ts        # crudRouter(service, schemas)
│   │   └── order.routes.ts
│   ├── middleware/errorHandler.ts# maps AppError / zod / Postgres errors to HTTP
│   ├── utils/AppError.ts
│   ├── app.ts                    # Express app
│   └── server.ts                 # starts HTTP server, graceful shutdown
├── Dockerfile                    # multi-stage build (TS → JS, prod deps only)
└── .env.example
```

Request flow: **route → controller (zod validation) → service (SQL) → PostgreSQL (constraints + triggers)**

---

## Database design

Tables come from the ER diagram, with these corrections:

| Table | Key | Relationship |
|---|---|---|
| `customer` | `cust_id` | places orders (1:N), makes payments (1:N) |
| `restaurant` | `rest_id` | offers menu items (1:N), prepares orders (1:N) |
| `delivery_person` | `dp_id` | independent, not tied to a restaurant; picks orders (1:N) |
| `menu_item` | `menu_item_id` | FK `rest_id` |
| `orders` | `o_id` | FKs `cust_id`, `rest_id`, `dp_id` (nullable until assigned) |
| `order_item` | (`o_id`, `line_no`) | **weak entity**; FKs `o_id`, `menu_item_id` (N:1) |
| `payment` | `pay_id` | FK `o_id` **UNIQUE** (1:1 with order), FK `cust_id` |
| `order_status_log` | `log_id` | audit trail, written only by a trigger |

Changes from the diagram:
- `O-ID` is the key, not `O-Date`.
- Order → Order Item is 1:N.
- Refers To is N:1.
- Name fields are split into `fname` + `lname`.
- `total_amount` is a derived attribute, kept up to date by a trigger.
- The Restaurant "has" Delivery Person relationship is removed: delivery partners are independent and any free one can take any order.

### Order lifecycle

```
PLACED ──pay──▶ PAID ──assign──▶ OUT_FOR_DELIVERY ──deliver──▶ DELIVERED
   │              │
   └──cancel──────┴──cancel──▶ CANCELLED   (payment marked REFUNDED)
```

---

## Transactions (hand-written)

[`src/db/transaction.ts`](src/db/transaction.ts):

```ts
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const result = await work(client);   // every query uses this same client
  await client.query('COMMIT');
  return result;
} catch (err) {
  await client.query('ROLLBACK');      // any error → undo everything
  throw err;
} finally {
  client.release();
}
```

The transactions live in [`src/services/order.service.ts`](src/services/order.service.ts):

| Endpoint | Steps inside one transaction | Concurrency control |
|---|---|---|
| `POST /orders` | INSERT order → INSERT each item | All-or-nothing: a bad item rolls back the whole order |
| `POST /orders/:id/items` etc. | lock order → change item | `SELECT … FOR UPDATE` on the order |
| `POST /orders/:id/pay` | lock order → INSERT payment → status `PAID` | `FOR UPDATE` blocks double payment |
| `POST /orders/:id/assign` | lock order → pick any free delivery person (idle longest first) → mark busy → `OUT_FOR_DELIVERY` | `FOR UPDATE SKIP LOCKED`, so parallel assigns never pick the same person |
| `POST /orders/:id/deliver` | status `DELIVERED` (trigger frees the delivery person) | `FOR UPDATE` |
| `POST /orders/:id/cancel` | refund payment → status `CANCELLED` | `FOR UPDATE` |
| `DELETE /orders/:id/items/:lineNo` | DELETE → if no items are left, throw → **ROLLBACK** | shows a rollback triggered by a business rule |

Migrations ([`migrate.ts`](src/db/migrate.ts)) and the seed run in transactions too.
> After a rolled-back insert, the next `o_id` skips a number. Sequences are not transactional in PostgreSQL; this is expected.

---

## Triggers

All in [`db/migrations/002_triggers.sql`](db/migrations/002_triggers.sql):

| # | Trigger | When | What it does |
|---|---|---|---|
| T1 | `trg_*_updated_at` | BEFORE UPDATE (5 tables) | sets `updated_at = now()` |
| T2 | `trg_order_item_validate` | BEFORE INSERT/UPDATE/DELETE on `order_item` | items can change only while the order is `PLACED`; the menu item must exist, be available and belong to the order's restaurant; copies `item_price` from the menu and makes it immutable; auto-numbers `line_no` |
| T3 | `trg_order_recalc_total` | AFTER INSERT/UPDATE/DELETE on `order_item` | recomputes `orders.total_amount` |
| T4 | `trg_order_validate_status` | BEFORE UPDATE OF status on `orders` | enforces the state machine; `PAID` requires a payment row; `OUT_FOR_DELIVERY` requires `dp_id` |
| T5 | `trg_order_after_insert` / `trg_order_after_status` | AFTER INSERT / UPDATE OF status on `orders` | writes `order_status_log`; frees the delivery person on `DELIVERED`/`CANCELLED` |
| T6 | `trg_payment_fill` | BEFORE INSERT on `payment` | copies the total and customer from the order, rejects an insufficient amount, computes `amount_returned` |

Errors raised by triggers (`RAISE EXCEPTION`, SQLSTATE `P0001`) come back from the API as **HTTP 400** with the trigger's message.

---

## API reference

Base URL: `/api`. Request and response bodies are JSON and use the DB column names (snake_case).

### Simple CRUD resources

| Resource | Path | List filters (query string) |
|---|---|---|
| Customers | `/customers` | — |
| Restaurants | `/restaurants` | — |
| Delivery persons | `/delivery-persons` | `is_available` |
| Menu items | `/menu-items` | `rest_id`, `item_category`, `is_available` |

Each supports: `GET /` (list, `?limit=20&offset=0`) · `GET /:id` · `POST /` · `PATCH /:id` (partial update) · `DELETE /:id`

### Orders

| Method & path | Body |
|---|---|
| `GET /orders` | filters: `status`, `cust_id`, `rest_id`, `dp_id` |
| `GET /orders/:id` | order with its items and payment |
| `GET /orders/:id/history` | status change log |
| `POST /orders` | `{ cust_id, rest_id, o_addr, items: [{ menu_item_id, quantity }] }` |
| `PATCH /orders/:id` | `{ o_addr }` (PLACED only) |
| `POST /orders/:id/items` | `{ menu_item_id, quantity }` |
| `PATCH /orders/:id/items/:lineNo` | `{ quantity }` |
| `DELETE /orders/:id/items/:lineNo` | — |
| `POST /orders/:id/pay` | `{ amount_paid }` |
| `POST /orders/:id/assign` | — |
| `POST /orders/:id/deliver` | — |
| `POST /orders/:id/cancel` | — |

### Payments (read-only)

These are created through `/orders/:id/pay` and refunded through `/orders/:id/cancel`.

`GET /payments` (filters: `cust_id`, `o_id`, `status`) · `GET /payments/:id`

### Example

```bash
curl -X POST localhost:3000/api/orders -H "Content-Type: application/json" \
  -d '{"cust_id":3,"rest_id":1,"o_addr":"Hinjewadi","items":[{"menu_item_id":1,"quantity":2}]}'

curl -X POST localhost:3000/api/orders/6/pay -H "Content-Type: application/json" -d '{"amount_paid":500}'
curl -X POST localhost:3000/api/orders/6/assign
curl -X POST localhost:3000/api/orders/6/deliver
curl localhost:3000/api/orders/6/history
```

### Error responses

| Status | When |
|---|---|
| 400 | Validation failure (zod), malformed JSON, CHECK violation, trigger rule (`P0001`) |
| 404 | Record or route not found |
| 409 | Duplicate (unique violation), record still referenced (FK), invalid order state for this action |
| 500 | Unexpected error |

---

## Seed data

[`src/db/seed.ts`](src/db/seed.ts) clears every table (`TRUNCATE … RESTART IDENTITY`) and inserts:

- 3 customers
- 3 restaurants
- 4 delivery persons
- 8 menu items

These go in one transaction. It then creates 5 sample orders, one in each state, through the real order service, so the triggers run.

To insert base data only: `npm run db:seed -- --no-orders`.
