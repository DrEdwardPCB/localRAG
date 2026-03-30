## ADDED Requirements

### Requirement: Ingest raw HTML into the knowledge store

The system SHALL accept an HTTP request containing **raw HTML** (string) plus metadata (at minimum optional title and scope fields such as `user_id` and optional `schema_id`). The system SHALL extract human-readable text server-side (e.g. via cheerio or jsdom), SHALL NOT fetch remote URLs from the HTML in v1 unless explicitly added in a future change, and SHALL strip or neutralize script content as part of extraction.

#### Scenario: Valid HTML paste

- **WHEN** the client sends HTML and required scope fields
- **THEN** the API persists a source record and chunk records with embeddings in MongoDB

### Requirement: Chunking and embedding pipeline

The system SHALL split extracted text into chunks with configurable size and overlap, SHALL embed chunks using `github-models-llm`, and SHALL upsert vectors and metadata into `mongodb-knowledge-store`.

#### Scenario: Multi-chunk document

- **WHEN** extracted text exceeds one chunk’s maximum size
- **THEN** multiple chunk documents are stored with stable ordering metadata

### Requirement: List and delete knowledge sources

The system SHALL expose operations to list knowledge sources visible in the current POC scope and to delete a source by id, triggering removal of associated chunks per `mongodb-knowledge-store`.

#### Scenario: List after ingest

- **WHEN** the client requests the source list after a successful ingest
- **THEN** the new source appears with identifiers needed for delete

### Requirement: Ingestion size limits

The system SHALL reject or truncate oversized payloads according to documented limits so a single paste cannot exhaust memory or provider quotas without feedback.

#### Scenario: Payload too large

- **WHEN** HTML content exceeds the configured maximum
- **THEN** the API returns an error without partial corrupt state
