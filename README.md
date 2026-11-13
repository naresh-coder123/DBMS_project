# Food Delivery System: DBMS Project

A food delivery app built from the project ER diagram.

| Folder | What | Docs |
|---|---|---|
| [`backend/`](backend) | REST API: Node.js, TypeScript, Express, PostgreSQL. Raw SQL with hand-written transactions and triggers; no ORM. | [backend/README.md](backend/README.md) |
| [`frontend/`](frontend) | React 19 + TypeScript + Vite | [frontend/README.md](frontend/README.md) |

## Run everything with Docker

```bash
docker compose up --build                       # db + api + web
docker compose exec api node dist/db/seed.js    # load sample data
```

| Service | URL |
|---|---|
| Frontend | http://localhost:8080 |
| API | http://localhost:3000/api |
| Postgres | localhost:5434 (postgres / postgres, db `food_delivery`) |

## Run locally for development

```bash
docker compose up -d db                                    # or use your own Postgres

cd backend  && npm install && npm run db:migrate && npm run db:seed && npm run dev   # :3000
cd frontend && npm install && npm run dev                                            # :5173, proxies /api to :3000
```
