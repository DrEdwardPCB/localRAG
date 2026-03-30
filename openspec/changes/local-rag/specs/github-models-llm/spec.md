## ADDED Requirements

### Requirement: GitHub Models access uses Foundry Inference SDK

The system SHALL invoke GitHub Models using `@azure-rest/ai-inference` and `@azure/core-auth` with `AzureKeyCredential` bound to `GITHUB_TOKEN`. The inference base URL SHALL default to `https://models.github.ai/inference` and SHALL be overridable via environment configuration.

#### Scenario: Client configured from environment

- **WHEN** the API process starts with valid `GITHUB_TOKEN` and optional endpoint override
- **THEN** a single shared inference client module is usable for embeddings and chat without exposing the token outside the server

### Requirement: Embeddings via non-streaming Inference API

The system SHALL compute text embeddings by calling the Inference SDK embeddings path (e.g. `POST` to `/embeddings` on the configured client) with a model id read from environment. The system SHALL treat `isUnexpected(response)` as failure and SHALL surface provider errors to the caller in a structured way.

#### Scenario: Batch string input

- **WHEN** the ingestion or RAG layer requests embeddings for one or more non-empty text strings
- **THEN** the system returns a numeric vector per input string from the configured embedding model without using streaming APIs

### Requirement: Chat completion is non-streaming and model-configurable

The system SHALL complete chat using the Inference SDK’s non-streaming chat/completions-style operation with a chat model id read from environment. The system SHALL return the full assistant message content in one response to the caller.

#### Scenario: Single-shot assistant reply

- **WHEN** the RAG layer submits messages and requests a completion
- **THEN** the system returns the assistant’s full text and does not require `@azure/core-sse` or chunked streaming delivery

### Requirement: No alternate LLM gateway in the happy path

The system SHALL NOT call a second external LLM provider for embeddings or chat in the default configuration. All embedding and chat traffic for the POC SHALL go through the GitHub Models inference endpoint described above.

#### Scenario: Default deployment

- **WHEN** the stack runs with only `GITHUB_TOKEN` and model env vars set
- **THEN** no OpenAI.com, Azure OpenAI (non-GitHub), or local inference endpoints are required for chat or embeddings
