# AI-assisted development log

## Disclosure

This repository was built with OpenAI Codex as an implementation partner. I retained responsibility for the scope, assumptions, financial rules, security choices, and final verification. This document is a task-specific record: unrelated private conversation from the same long-running assistant thread is intentionally excluded.

The original challenge prompt and attachment were provided to Codex on 2026-08-19. The working instruction was to inspect the challenge, implement a professional submission, test it, and prepare it for deployment.

## Initial brief interpreted with AI

The supplied challenge requested:

- an ASP.NET Core API and a React + TypeScript frontend;
- source-file upload and parsing;
- Net, VAT, and Gross totals broken down by VAT category;
- PDF output;
- robust error and threat handling;
- a runnable/deployed application, repository, instructions, and AI conversation record.

The source brief did not specify a transaction-file schema, currency, rounding policy, or whether correction notes should be supported. I chose and documented an explicit CSV contract rather than letting the implementation infer ambiguous formats.

## Prompts and decisions

### Domain and architecture prompt

**Instruction to AI:** Design the smallest production-minded architecture that satisfies the brief. Keep the system stateless, separate parsing from calculation and rendering, avoid unnecessary packages, and make assumptions explicit.

**Decision reviewed and accepted:**

- UTF-8 CSV with `invoiceNumber,date,netAmount,vatRate`.
- Comma or semicolon delimiters; Hungarian decimal commas for semicolon files.
- Supported VAT categories: 0%, 5%, 18%, and 27%.
- HUF values calculated with .NET `decimal`.
- Per-transaction rounding to two decimal places, midpoint away from zero.
- Negative net lines allowed for correction notes.
- Minimal API endpoints for JSON and PDF from the same calculation service.

### Security prompt

**Instruction to AI:** Threat-model an unauthenticated upload endpoint. Prevent oversized or binary input, resource exhaustion, unsafe filenames, formula/code execution, accidental storage, information leaks, cross-origin abuse, and noisy repeated requests. Return useful but non-sensitive validation feedback.

**Implemented controls reviewed by me:**

- 2 MB request/file limit and 10,000-row limit.
- Strict UTF-8 decoding, null-byte rejection, bounded field lengths and amount ranges.
- Exactly one `.csv` file; only the basename is retained for display.
- No file persistence, spreadsheet execution, shell invocation, or dynamic code.
- Maximum of 50 reported validation errors.
- Structured 422 row errors and generic unexpected-error responses.
- Per-IP rate limiting, restricted CORS, and defensive response headers.
- Non-root, read-only production container.

### Reliability prompt

**Instruction to AI:** Identify financial edge cases and add focused automated tests. Do not use floating point. Verify positive and negative half-cent rounding, all VAT categories, locale-specific decimals, malformed input, and generated PDF structure.

**Result:** Six backend tests were implemented and passed. The strict TypeScript frontend also compiled successfully. A direct HTTP smoke test confirmed the expected JSON category totals and a valid `application/pdf` response.

### UI prompt

**Instruction to AI:** Build a restrained, professional tax-product interface. Prioritise file requirements, actionable row errors, readable HUF totals, responsive layout, keyboard access, reduced-motion support, and one-click sample data and PDF export.

**Result:** The frontend provides drag-and-drop and keyboard upload, client-side file checks, server validation display, grouped summary cards/table, responsive styles, loading states, and accessible labels.

## Issues caught during implementation

1. A response-header convenience property was unavailable in the selected ASP.NET Core surface. It was replaced with explicit header appends and the backend rebuilt successfully.
2. The first test compile lacked the explicit xUnit namespace import. It was added, after which all six tests passed.
3. Strict TypeScript compilation exposed a missing Vite CSS declaration and an incompatible project option. A Vite type reference and corrected project configuration resolved both issues.
4. The local browser-control integration failed a trusted-path check. This was not treated as a pass: the initial screen was rendered with installed Edge in headless mode and inspected, while the JSON, validation, and PDF flows were exercised directly over HTTP.
5. The first Alpine container exited because ICU was absent. Adding `icu-libs` allowed startup, but a further smoke test showed that the English-only ICU dataset still rejected Hungarian decimal commas. The runtime was changed to use `icu-data-full`, rebuilt, and the Hungarian sample was successfully recalculated inside the final container.
6. The generated PDF was rendered to PNG with Poppler and inspected for clipping, overlap, hierarchy, table alignment, totals, and footer placement. No visual defects were found.

## Human review checklist

- [x] Challenge requirements mapped to implementation.
- [x] CSV contract and tax assumptions documented.
- [x] Calculation examples and automated tests reviewed.
- [x] No uploads or user data persisted.
- [x] No secrets, credentials, or private environment data committed.
- [x] Production frontend build completed.
- [x] JSON and PDF HTTP endpoints smoke-tested.
- [x] Production Docker image built and tested with valid, invalid, and Hungarian-locale samples.
- [x] Initial UI and generated PDF rendered and visually inspected.
- [x] Public deployment URL verified after repository publication.

## Tools used

- OpenAI Codex (model used: 5.6 Sol) for architecture discussion, implementation support, review, and debugging.
- .NET 8 SDK for build and xUnit tests.
- Node.js/npm, TypeScript, and Vite for the frontend build.
- Docker configuration for reproducible delivery.

No AI-generated conclusion was accepted solely on assertion; calculations and build behaviour were checked with deterministic tests or executable commands.
