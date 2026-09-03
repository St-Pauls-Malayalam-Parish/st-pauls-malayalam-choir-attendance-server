# St Paul's Malayalam Parish — Choir (API)

Node / Express API and MongoDB for the parish choir attendance app.

**Repo:** [St-Pauls-Malayalam-Parish/attendance-server](https://github.com/St-Pauls-Malayalam-Parish/attendance-server)

**Frontend:** [attendance-application](https://github.com/St-Pauls-Malayalam-Parish/attendance-application)

## Requirements

- Node.js 18+
- Podman or Docker (for local MongoDB)

## Setup

```bash
npm install
cp .env.example .env
npm run mongo:up
npm run seed          # first time only: create admin if missing
npm run dev
```

API: [http://localhost:4000](http://localhost:4000)

## Environment

Copy `.env.example` to `.env`:

| Variable | Example | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27018/choir` | MongoDB connection |
| `JWT_SECRET` | long random string | Session signing |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Frontend URL (CORS + cookies) |
| `ADMIN_USERNAME` | `admin` | Seed admin login username |
| `ADMIN_EMAIL` | `admin@choir.local` | Seed admin contact email |
| `ADMIN_PASSWORD` | `choiradmin` | Seed admin password |

MongoDB uses port **27018** so it does not clash with a local `mongod` on 27017.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | API with auto-reload |
| `npm run start` | API (production) |
| `npm run seed` | Create admin account if none exists |
| `npm run mongo:up` | Start MongoDB in Podman |
| `npm run mongo:down` | Stop MongoDB container |
| `npm run mongo:logs` | Tail MongoDB logs |

## Auth

JWT in an **httpOnly cookie** (`token`). Passwords hashed with bcrypt.

## Logins (after seed)

Sign in with **username** and password (not email). Only the **admin** account is created by `npm run seed`.

| Role | Username | Password |
| --- | --- | --- |
| Admin | value of `ADMIN_USERNAME` (default `admin`) | value of `ADMIN_PASSWORD` |

Members join via **Register** on the frontend (admin approves) or are added under **Admin → Members**.

## Frontend

Pair with [attendance-application](https://github.com/St-Pauls-Malayalam-Parish/attendance-application). Set `CLIENT_ORIGIN` to the frontend URL.

## Deploy on Render

1. **MongoDB Atlas** (free M0 cluster)
   - Create a cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
   - Database Access → add a user with read/write.
   - Network Access → allow `0.0.0.0/0` (or Render’s egress IPs).
   - Connect → Drivers → copy the connection string and set database name to `choir`.

2. **Render Web Service**
   - [New Web Service](https://dashboard.render.com/) → connect repo [attendance-server](https://github.com/St-Pauls-Malayalam-Parish/attendance-server).
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment variables:**

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Atlas connection string |
   | `JWT_SECRET` | long random string |
   | `CLIENT_ORIGIN` | `https://st-pauls-malayalam-parish.github.io` |
   | `ADMIN_USERNAME` | `admin` |
   | `ADMIN_EMAIL` | (optional, for seed) |
   | `ADMIN_PASSWORD` | (optional, for seed) |

   Render sets `PORT` automatically — do not override it.

   If you renamed the GitHub repo, update the connected repository under **Settings → Build & Deploy** on your existing Render service (the public URL can stay the same).

3. **Seed production admin** (once, from your machine with Atlas URI in `.env`):

   ```bash
   MONGODB_URI="mongodb+srv://..." npm run seed
   ```

   Safe to re-run: it only creates an admin when none exists.

4. **Frontend**
   - In [attendance-application](https://github.com/St-Pauls-Malayalam-Parish/attendance-application), set GitHub Actions variable `VITE_API_URL` to your Render URL (e.g. `https://attendance-server.onrender.com` or your existing service URL).
   - Redeploy the client workflow.

5. **Smoke test**
   - `GET https://<your-service>.onrender.com/api/health` → `{ "ok": true }`
   - Sign in from the GitHub Pages app; cookies use `SameSite=None; Secure` in production.

## Git remote

```bash
git remote set-url origin https://github.com/St-Pauls-Malayalam-Parish/attendance-server.git
```
