# Roadmap

This roadmap describes likely directions for Baotuo Chat. It is not a commitment
to ship every item, and priorities may change as contributors find bugs,
deployment issues, or simpler implementation paths.

## Near Term

- Keep local-first chat, workspace, skill, plugin, assistant, memory, and knowledge flows
  stable across browser refreshes and storage migrations.
- Keep public documentation current as deployment, skills, plugin execution,
  privacy, and configuration behavior changes.
- Tighten CI quality gates with formatting, linting, type checking, tests,
  builds, and dependency audits.

## Mid Term

- Continue improving hosted deployment readiness with operational checks,
  shared-store diagnostics, and safer defaults.
- Expand plugin and skills workflow examples for OpenAPI-compatible tools and
  text-only reusable instructions.
- Improve knowledge-base recovery, indexing diagnostics, and user-facing error
  states.
- Add more screenshots and workflow examples for common model, search, RAG,
  voice, skills, plugin, and deployment health setups.

## Later

- Publish formal releases with release notes, versioned Docker image guidance,
  and upgrade notes.
- Evaluate provider spend controls (per-user cost caps beyond the current
  request-count quota) and tenant isolation for team-level deployments.

## Known Limitations

- `ACCESS_PASSWORD` alone is only a deployment gate. For per-user accounts
  set `DATABASE_URL` + `ACCOUNT_SESSION_SECRET` to enable the optional
  email/password account layer (per-user sessions, per-user daily request
  quotas, audit log). Account records live server-side; chat history and
  knowledge bases stay client-side either way. There is intentionally no
  admin UI — quota/ban/session changes are made by editing database rows
  directly. See `docs/environment-variables.md`.
- Runtime plugin calls execute automatically after a plugin is enabled for a
  chat; users should only enable plugins they trust.
- Skills are text-only prompt context. They do not execute scripts, call
  networks, or access local files.
