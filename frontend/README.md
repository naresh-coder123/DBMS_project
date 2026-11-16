# Food Delivery: Frontend

React 19 + TypeScript + Vite.

```bash
npm install
npm run dev        # http://localhost:5173
```

In dev, Vite proxies `/api` and `/health` to the backend at `http://localhost:3000` (see `vite.config.ts`), so call the API with relative URLs such as `fetch('/api/restaurants')`. Start the backend first.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

In Docker, nginx serves the build and proxies `/api` to the `api` container (see `nginx.conf`).
