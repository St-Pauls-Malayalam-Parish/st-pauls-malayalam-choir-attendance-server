# St Paul's Malayalam Parish — Choir (API)

Node / Express API and MongoDB for the parish choir attendance app.

## Requirements

- Node.js 18+
- Podman or Docker (for local MongoDB)

## Setup

```bash
npm install
cp .env.example .env
npm run mongo:up
npm run seed          # first time: admin + parish members
npm run onboard       # first time: attendance history from report
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
| `ADMIN_EMAIL` | `admin@choir.local` | Seed admin email |
| `ADMIN_PASSWORD` | `choiradmin` | Seed admin password |

MongoDB uses port **27018** so it does not clash with a local `mongod` on 27017.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | API with auto-reload |
| `npm run start` | API (production) |
| `npm run seed` | Create admin + parish members |
| `npm run onboard` | Load attendance from parish report |
| `npm run mongo:up` | Start MongoDB in Podman |
| `npm run mongo:down` | Stop MongoDB container |
| `npm run mongo:logs` | Tail MongoDB logs |

## Auth

JWT in an **httpOnly cookie** (`token`). Passwords hashed with bcrypt.

## Logins (after seed)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@choir.local` | `choiradmin` |
| Member | `angel.benny@choir.local` | `choirpass` |

Member emails: `firstname.lastname@choir.local`

## Frontend

Pair with [choir-client](https://github.com/your-org/choir-client). Set `CLIENT_ORIGIN` to the frontend URL.
