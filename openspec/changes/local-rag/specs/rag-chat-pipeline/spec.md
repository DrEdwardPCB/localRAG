## ADDED Requirements

### Requirement: Chat endpoint accepts n8n-aligned fields

The system SHALL expose `POST /chat` (or an equivalent single chat route) accepting JSON including `chat_message` and `session_id`, optional `system_prompt`, and scope fields aligned with `eklab-chatbot.json` intent (`user_id`, `schema_id`, and a field identifying the knowledge / vector scope such as a knowledge base id or legacy-compatible collection identifier).

#### Scenario: Minimal body

- **WHEN** the client sends `chat_message` and `session_id`
- **THEN** the API returns a JSON response with assistant text and does not require SSE

### Requirement: RAG orchestration with LangChain

The system SHALL implement retrieval-augmented generation using LangChain (JS): load prior messages from `redis-session-context`, embed the user query via `github-models-llm`, retrieve top-k chunks from `mongodb-knowledge-store` scoped to the request, optionally load schema-oriented metadata from MongoDB when `schema_id` is provided, assemble a prompt, invoke non-streaming chat completion, append the assistant turn to Redis, and return the assistant message.

#### Scenario: Grounded answer

- **WHEN** the knowledge base contains relevant chunks and the user asks a question in `chat_message`
- **THEN** the assistant response is influenced by retrieved chunk text and prior session turns

### Requirement: JSON request–response only

The system SHALL NOT use Server-Sent Events or streaming HTTP for chat responses in this change. The full assistant message SHALL be returned in the JSON body once generation completes.

#### Scenario: Client awaits complete reply

- **WHEN** the client calls the chat endpoint
- **THEN** the HTTP response is a single JSON document containing the complete assistant output

### Requirement: Error reporting for provider and retrieval failures

The system SHALL return appropriate HTTP status codes and machine-readable error bodies when GitHub Models calls fail, when retrieval returns no chunks (still MAY answer with model-only behavior if explicitly designed), or when Redis/MongoDB are unavailable.

#### Scenario: Inference failure

- **WHEN** the Inference SDK returns an unexpected error
- **THEN** the API responds with an error status and does not leak raw tokens in the response body
