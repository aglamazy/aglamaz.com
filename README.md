# Aglamaz — `agents-*` lib index

This directory holds the proprietary `agents-*` libraries that AgentsHead-delivered customer projects (Ilan-Oz, Itzik, Elron, Ilya, Wings, Karina, etc.) compose. Each lib is a small, focused TypeScript package — DI-driven, zero-direct `process.env` access, calendar-versioned `YY.M.#` (never semver).

Customer projects consume them via private GitHub git deps: `"agents-<name>": "github:aglamazy/agents-<name>#vYY.M.#"`. Vercel builds resolve them through `AH_GITHUB_TOKEN` (the `ah-deploy-agents-all` fine-grained PAT, scoped to read Contents+Metadata on each lib).

## Libraries

| Lib | Version | One-liner | Repo |
|---|---|---|---|
| [`agents-ai`](./agents-ai) | `26.5.0` | Multi-provider LLM adapter (Claude + Gemini) and multi-step agentic chat engine with pluggable tools. | [aglamazy/agents-ai](https://github.com/aglamazy/agents-ai) |
| [`agents-agent`](./agents-agent) | `26.5.2` | Long-running agent runtime: scheduling, escalation, tool composition, per-tenant isolation, activation modes (reactive / scheduled / account). Wraps `agents-ai`'s `processChat`. | [aglamazy/agents-agent](https://github.com/aglamazy/agents-agent) |
| [`agents-backoffice`](./agents-backoffice) | `26.5.0` | Next.js + Firebase Auth + Drizzle/Neon backoffice scaffold with RTL Hebrew admin layout. | [aglamazy/agents-backoffice](https://github.com/aglamazy/agents-backoffice) |
| [`agents-billing`](./agents-billing) | `26.5.0` | Thin Ypay-webhook handler + Firebase writer. Standing-order + webhook billing model — NOT a charge orchestrator (Upay standing orders are set up manually in Upay UI per customer). | [aglamazy/agents-billing](https://github.com/aglamazy/agents-billing) |
| [`agents-gdrive`](./agents-gdrive) | `26.5.2` | Google Drive integration: OAuth, scoped folder access, MCP-shaped tools (`list_files`, `read_file`, `read_pdf`, `get_file_url`, `write_file`, `search_files`) for `agents-ai`. | [aglamazy/agents-gdrive](https://github.com/aglamazy/agents-gdrive) |
| [`agents-quota`](./agents-quota) | `26.5.2` | Per-customer × per-service × per-period quota lib. Runtime enforcement; customer Firebase is the source of truth. 80% soft-warning signal with per-period dedup. | [aglamazy/agents-quota](https://github.com/aglamazy/agents-quota) |
| [`agents-voice`](./agents-voice) | `26.5.18` | Multi-tenant audio bridge between Telnyx Media Streams and OpenAI Realtime API. One Cloud Run service multiplexes many customer phone numbers via Firestore config. | [aglamazy/agents-voice](https://github.com/aglamazy/agents-voice) |
| [`agents-whatsapp`](./agents-whatsapp) | `26.5.0` | WhatsApp Cloud API client + webhook handler. Zero runtime deps; framework-agnostic webhook factory. | [aglamazy/agents-whatsapp](https://github.com/aglamazy/agents-whatsapp) |

Not yet shipped: [`agents-matching`](./agents-matching) — design WIP, no published version.

## Conventions

- **CalVer `YY.M.#`** — two-digit year, month, sequential patch. Git tags `vYY.M.#` (e.g. `v26.5.2`). Never semver. A new month resets the patch (`26.5.x` → `26.6.0`).
- **Private repos.** All `agents-*` libs are private under the `aglamazy/` org.
- **Install via git tag**, not npm. Customers pin: `"agents-<name>": "github:aglamazy/agents-<name>#vYY.M.#"`. The `ah-deploy-agents-all` fine-grained PAT (`AH_GITHUB_TOKEN` env on Vercel) must include each lib in its allowlist before first deploy — see [project_ah_deploy_gh_token](#) memory.
- **Zero direct `process.env` access** inside the libs. Consumers read env vars and pass values into config structs.
- **DI everywhere.** Storage, LLM client, rate limiter, escalation dispatcher are all plugged in by the consumer. Libs ship the interface + a `Noop*` impl; the customer-project app routes Firestore / Neon / whatever under it.
- **ESM-only, `dist/` outDir, multi-export** (`.`, `./glue`, `./admin` where applicable). `tsc --build` produces the published artifact; `dist/` is committed and ships in the git-dep tarball.
- **Tests via `node:test` + `tsx`.** No vitest/jest. Each lib has a `tests/` dir.

## Where libs live downstream

- **AgentsHead admin (`~/develop/AgentsHead/agents-head.com`)** — primary consumer. Imports `agents-ai`, `agents-gdrive`, `agents-whatsapp`, `agents-backoffice`, `agents-agent` (incoming via Super+4 / Ilan-Oz).
- **Customer projects** (Aglamazo, Elron, Itzik, Wings, etc.) — one repo per customer, each pulls the subset it needs. Domain-specific glue lives in the customer repo.
- **`agents-voice`** — deployed standalone as a Cloud Run service; not imported as a lib but as a service. Customer Vercel projects own the tools + call-record sinks the voice bridge calls back into.

## Adding a new `agents-*` lib

1. Scaffold the package structure (mirror `agents-quota` — it's the smallest reasonable template).
2. Start the version at `YY.M.0` for the current month.
3. Create the private GitHub repo: `gh repo create aglamazy/agents-<name> --private --source=. --remote=origin --push`.
4. Tag `vYY.M.0` and push the tag.
5. Add the new repo to the `ah-deploy-agents-all` PAT's allowed-repo list (web only, max 50). Otherwise the first Vercel deploy in any consumer will 403 on `npm install`.
6. Add the dep to consumers: `"agents-<name>": "github:aglamazy/agents-<name>#vYY.M.0"`.
