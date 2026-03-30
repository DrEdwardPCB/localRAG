## ADDED Requirements

### Requirement: Chat interface with client-side session id

The Next.js application SHALL provide a chat UI that generates or reuses a `session_id` (e.g. UUID) stored in `sessionStorage` or equivalent browser storage. The client SHALL send `session_id` with each chat request to the backend.

#### Scenario: Page reload in same tab

- **WHEN** the user reloads the chat page without clearing storage
- **THEN** the same `session_id` is reused for subsequent messages

### Requirement: No user authentication in v1

The application SHALL NOT implement login, OAuth, or API-key entry in the browser for POC. The app SHALL assume a trusted local compose environment as described in `design.md`.

#### Scenario: First visit

- **WHEN** a user opens the app with no prior auth flow
- **THEN** they can use chat and knowledge features without credentials

### Requirement: Knowledge side panel for HTML ingest

The application SHALL provide a side panel (collapsible or fixed) where the user pastes raw HTML and submits ingestion. The panel SHALL list existing sources and allow delete actions that call the backend.

#### Scenario: Successful upload flow

- **WHEN** the user pastes HTML and clicks upload
- **THEN** the client calls the ingestion API and refreshes the source list on success

### Requirement: Secrets stay on the server

The browser SHALL NOT receive `GITHUB_TOKEN` or other model credentials. Chat and ingestion calls SHALL target the backend API or Next.js server routes that proxy to the API without exposing secrets to client bundles.

#### Scenario: Network inspection

- **WHEN** a user inspects client-loaded JavaScript and network calls from the browser
- **THEN** `GITHUB_TOKEN` does not appear in client-side code or browser-origin requests

### Requirement: Compose-friendly configuration

The web app SHALL read public configuration such as API base URL from environment (e.g. `NEXT_PUBLIC_API_URL`) so `docker compose up` works with documented `.env.example` values.

#### Scenario: Docker web service

- **WHEN** the web container starts with `NEXT_PUBLIC_API_URL` pointing at the API service
- **THEN** browser-originated fetches reach the API successfully within the compose network
