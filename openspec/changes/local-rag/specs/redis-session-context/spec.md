## ADDED Requirements

### Requirement: Session-scoped chat history in Redis

The system SHALL persist conversational turns per `session_id` in Redis using a key namespace dedicated to chat memory. The format SHALL be compatible with the LangChain Redis chat memory pattern or an equivalent documented adapter.

#### Scenario: Same session id across requests

- **WHEN** two consecutive chat requests use the same `session_id`
- **THEN** the second request sees prior user and assistant messages loaded from Redis before generating a new reply

### Requirement: Twenty-four hour TTL on session keys

The system SHALL apply a time-to-live of **24 hours** to Redis keys backing a session’s chat history (fixed expiry or sliding refresh—one policy SHALL be chosen and documented in implementation).

#### Scenario: Idle session expires

- **WHEN** no activity occurs for a session key beyond the TTL policy’s window
- **THEN** Redis no longer returns prior messages for that `session_id`

### Requirement: Bounded context window

The system SHALL limit the number of recent messages loaded into the model context (e.g. last N turns), configurable within reasonable defaults, so Redis growth per session is bounded in addition to TTL.

#### Scenario: Long conversation

- **WHEN** a session exceeds the configured message window
- **THEN** older messages are omitted from the prompt while the session key may still exist until TTL
