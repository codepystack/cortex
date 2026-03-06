# Cortex AI Platform

An open AI platform built with a **Rust/Axum backend** and a **Next.js frontend**.

## Architecture

```
cortex/
├── backend/   # Rust + Axum REST API
└── frontend/  # Next.js 16 + Tailwind CSS chat UI
```

## Screenshots

### Login
![Login](https://github.com/user-attachments/assets/70729d1f-1509-49ee-ba0b-51a3ca184416)

### Chat Interface
![Chat](https://github.com/user-attachments/assets/0b4c7ee7-8c45-4adb-ac00-15f3a4ff81a2)

---

## Backend (Rust / Axum)

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/v1/models` | List available models |
| POST | `/v1/chat/completions` | OpenAI-compatible chat completions (streaming + non-streaming) |
| POST | `/v1/auth/register` | Register a new user |
| POST | `/v1/auth/login` | Login and receive JWT |
| GET | `/v1/auth/me` | Get current user info (requires `Authorization: Bearer <token>`) |

### Getting started

```bash
cd backend
cp .env.example .env
# Edit .env to add your provider API keys (optional)
cargo run
# Server listens on http://localhost:8080
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8080` | Bind port |
| `JWT_SECRET` | (dev value) | Secret used to sign JWTs — **change in production** |
| `OPENAI_API_KEY` | *(empty)* | OpenAI API key (enables GPT models) |
| `ANTHROPIC_API_KEY` | *(empty)* | Anthropic API key (enables Claude models) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list of allowed CORS origins |

### Running tests

```bash
cd backend
cargo test
```

### Built-in models

| Model ID | Provider | Notes |
|----------|----------|-------|
| `cortex-echo` | local | Always available; echoes your input back (great for demos) |
| `gpt-4o`, `gpt-4o-mini`, … | OpenAI | Requires `OPENAI_API_KEY` |
| `claude-3-5-sonnet-*`, … | Anthropic | Requires `ANTHROPIC_API_KEY` |

---

## Frontend (Next.js / Tailwind)

### Getting started

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local to point at your backend
npm install
npm run dev
# UI available at http://localhost:3000
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Backend base URL |

### Features

- **Auth flow** — register / login with JWT stored in `localStorage`
- **Model selector** — dynamically populated from `/v1/models`
- **Streaming chat** — SSE-based token-by-token streaming
- **Markdown rendering** — assistant messages rendered with `react-markdown` + GFM
- **Dark mode** — Tailwind `dark:` classes, follows OS preference
- **Responsive** — works on mobile and desktop
