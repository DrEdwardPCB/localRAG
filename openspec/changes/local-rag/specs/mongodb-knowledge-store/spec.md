## ADDED Requirements

### Requirement: Persist knowledge sources and chunk documents

The system SHALL store uploaded knowledge as **source** records (metadata such as title, owner `user_id`, optional `schema_id`, timestamps, and optional raw HTML or reference fields) and as **chunk** records containing chunk text, ordering metadata (`chunkIndex` or equivalent), `knowledgeSourceId`, and an `embedding` vector field suitable for vector search.

#### Scenario: Ingestion completes

- **WHEN** ingestion finishes for a valid HTML payload
- **THEN** one source document and one or more chunk documents exist in MongoDB linked by identifier

### Requirement: Vector search index for retrieval

The system SHALL define a MongoDB Atlas Vector Search index (or equivalent supported by `mongodb/mongodb-atlas-local`) over chunk embeddings so that `$vectorSearch` (or the supported query form) can return top-k chunks filtered by knowledge scope.

#### Scenario: Query-time retrieval

- **WHEN** the RAG layer runs a similarity search with a query embedding and scope filters (e.g. `user_id`, `schema_id`, or knowledge base id)
- **THEN** the database returns ranked chunks with scores without a separate vector database

### Requirement: Scoped deletion

The system SHALL support deleting a knowledge source such that associated chunks are removed or become unreachable from retrieval (hard delete or equivalent).

#### Scenario: User deletes a source

- **WHEN** the API receives a delete request for an existing source id
- **THEN** subsequent retrieval SHALL NOT return chunks from that source

### Requirement: No fixed retention policy in POC

The system SHALL NOT automatically expire MongoDB knowledge data for POC; retention limits beyond manual delete are out of scope for this change.

#### Scenario: Data remains until deleted

- **WHEN** knowledge is stored and no delete is performed
- **THEN** documents remain available for retrieval indefinitely within the POC assumptions
