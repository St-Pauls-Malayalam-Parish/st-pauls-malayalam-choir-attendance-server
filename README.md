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
| `ADMIN_EMAIL` | `admin@stpauls.parish` | Seed admin contact email |
| `ADMIN_PASSWORD` | `choiradmin` | Seed admin password |

MongoDB uses port **27018** so it does not clash with a local `mongod` on 27017.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | API with auto-reload |
| `npm run start` | API (production) |
| `npm run seed` | Create admin account if none exists |
| `npm run import-members` | Import approved members from `data/members.json` |
| `npm run migrate-email-domain` | Rewrite legacy `@choir.local` emails to `@stpauls.parish` |
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

## Import existing members

For a one-time roster import, copy the sample file and edit your choir list:

```bash
cp data/members.sample.json data/members.json
# edit data/members.json — one object per singer
npm run import-members -- --dry-run
npm run import-members
```

Each row needs at least a **name**. Optional fields: `username`, `email` (defaults to `username@stpauls.parish`), `voicePart` (`soprano` | `alto` | `tenor` | `bass` | `other`), and `password` (otherwise all imported members share the default).

Default password is `Choir@2026`, or set `MEMBER_DEFAULT_PASSWORD` in `.env`:

```bash
MEMBER_DEFAULT_PASSWORD='Choir@2026' npm run import-members
```

Imported members are created as **approved** and can sign in immediately with their username. Ask them to change their password under **Account** after first login.

The script skips anyone whose username or email already exists.

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
   - `GET https://<your-service>.onrender.com/api/health` → `{ "ok": true, "database": { "connected": true, "name": "choir" }, ... }`
   - Returns **503** if MongoDB is unreachable.
   - Sign in from the GitHub Pages app; cookies use `SameSite=None; Secure` in production.

## Git remote

```bash
git remote set-url origin https://github.com/St-Pauls-Malayalam-Parish/attendance-server.git
```
