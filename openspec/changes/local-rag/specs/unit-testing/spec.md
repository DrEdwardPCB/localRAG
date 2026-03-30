## ADDED Requirements

### Requirement: Unit test runner and script

The repository SHALL provide a documented command (e.g. `pnpm test`, `npm test`, or `pnpm -r test`) that executes **unit** tests without starting `docker compose` services. The chosen runner SHALL be one of **Vitest** or **Jest** and SHALL be configured for TypeScript in `apps/api` at minimum.

#### Scenario: CI or local developer runs tests

- **WHEN** a developer runs the documented test command from a clean clone with only Node dependencies installed
- **THEN** unit tests execute and exit with a non-zero code on failure without requiring MongoDB, Redis, or GitHub network calls by default

### Requirement: Mock external boundaries in unit scope

Unit tests for the API SHALL **mock** the GitHub Models Inference SDK client (or the project’s thin wrapper around it), MongoDB driver calls, and Redis client calls so that tests do not require real credentials or running containers.

#### Scenario: Inference error path

- **WHEN** a test simulates `isUnexpected` or provider error from the embeddings or chat call
- **THEN** the application code under test surfaces a structured error without performing a real HTTP request

### Requirement: Cover deterministic ingestion and parsing

The implementation SHALL include unit tests for **HTML-to-text extraction** (including script stripping behavior) and **chunking** (e.g. chunk boundaries and overlap) using fixed input fixtures.

#### Scenario: HTML fixture

- **WHEN** a sample HTML string containing scripts and body text is passed through the extractor
- **THEN** tests assert the extracted plain text matches expected output

### Requirement: Cover validation and session helpers

The implementation SHALL include unit tests for **ingestion payload size limits** and for **Redis session key naming / TTL policy** logic as implemented (pure functions or testable helpers).

#### Scenario: Oversized ingest

- **WHEN** input exceeds the configured maximum size
- **THEN** validation rejects the request in a way covered by a unit test without calling MongoDB
