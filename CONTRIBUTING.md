# Contributing to Cortex

Thank you for your interest in contributing to Cortex! We welcome contributions of all kinds — bug fixes, new features, documentation improvements, and more.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [License](#license)

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct. By participating, you are expected to uphold this standard. Please be respectful and constructive in all interactions.

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/cortex.git
   cd cortex
   ```
3. **Add the upstream remote** so you can pull in future changes:
   ```bash
   git remote add upstream https://github.com/codepystack/cortex.git
   ```
4. Create a new branch for your work:
   ```bash
   git checkout -b feat/my-new-feature
   ```

---

## How to Contribute

### Reporting Bugs

- Search [existing issues](https://github.com/codepystack/cortex/issues) first to avoid duplicates.
- Open a new issue using the **Bug Report** template.
- Include:
  - A clear description of the problem
  - Steps to reproduce
  - Expected vs. actual behaviour
  - Environment details (OS, Rust version, Node version)

### Suggesting Features

- Search [existing issues](https://github.com/codepystack/cortex/issues) for similar requests.
- Open a new issue using the **Feature Request** template.
- Describe the motivation and the proposed solution.

### Submitting Pull Requests

1. Ensure your branch is up to date with `upstream/main`.
2. Make sure the **backend tests pass**:
   ```bash
   cd backend && cargo test
   ```
3. Make sure the **frontend type-checks cleanly**:
   ```bash
   cd frontend && npm run check
   ```
4. Open a Pull Request against the `main` branch.
5. Fill in the PR template — describe what changed and why.
6. A maintainer will review and may request changes before merging.

---

## Development Setup

### Prerequisites

| Tool | Minimum version |
|------|----------------|
| Rust | 1.78 (stable) |
| Node.js | 20 LTS |
| npm | 10 |

### Backend (Rust / Axum)

```bash
cd backend
cp .env.example .env
# Edit .env to add optional provider API keys
cargo run
# API available at http://localhost:8080
```

Run tests:
```bash
cargo test
```

### Frontend (SvelteKit / Tailwind)

```bash
cd frontend
npm install
npm run dev
# UI available at http://localhost:3000
```

Type-check:
```bash
npm run check
```

---

## Project Structure

```
cortex/
├── backend/          # Rust + Axum REST API
│   └── src/
│       ├── main.rs           # Entry point, router setup
│       ├── registry.rs       # Central model/tool/agent registry
│       └── routes/           # Route handlers
└── frontend/         # SvelteKit UI
    └── src/
        ├── lib/
        │   ├── api.ts        # API client
        │   ├── stores/       # Svelte stores (auth, etc.)
        │   └── components/   # UI components (shadcn-svelte)
        └── routes/           # SvelteKit pages
```

---

## Coding Standards

### Rust (backend)

- Follow the standard [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/).
- Run `cargo fmt` before committing.
- Run `cargo clippy -- -D warnings` and fix all warnings.
- Keep public items documented with `///` doc comments.

### TypeScript / Svelte (frontend)

- Prefer typed code — avoid `any`.
- Run `npm run check` before committing.
- Follow the existing component structure in `src/lib/components/`.

---

## Commit Messages

Use short, descriptive commit messages in the imperative mood:

```
feat: add streaming support for Claude models
fix: correct JWT expiry calculation
docs: update contributing guide
```

Prefixes: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`.

---

## License

By contributing to Cortex, you agree that your contributions will be licensed under the [MIT License](LICENSE).
