## ADDED Requirements

### Requirement: Chunked audio extraction
The system SHALL continuously extract audio from the live stream in fixed-duration chunks.

#### Scenario: Audio chunk generation
- **WHEN** a stream is active
- **THEN** the backend SHALL extract a 10-second audio chunk every 10 seconds from the RTMP stream using ffmpeg

### Requirement: Whisper transcription with context
The system SHALL transcribe each audio chunk using mlx_whisper with context from the previous chunk.

#### Scenario: First chunk transcription
- **WHEN** the first audio chunk is ready
- **THEN** the system SHALL transcribe it with mlx_whisper and return text + word-level timestamps

#### Scenario: Subsequent chunk with context
- **WHEN** a non-first audio chunk is ready
- **THEN** the system SHALL pass the previous chunk's transcript as `initial_prompt` to improve proper noun accuracy

### Requirement: WebSocket realtime delivery
The system SHALL push transcription results to the frontend via WebSocket as each chunk completes.

#### Scenario: Transcript delivery
- **WHEN** a chunk transcription completes
- **THEN** the system SHALL emit a WebSocket message containing `{ text, segments: [{ start, end, text }] }` to all connected clients

### Requirement: Transcription latency
The total latency from audio occurrence to transcript delivery SHALL be under 15 seconds.

#### Scenario: Latency budget
- **WHEN** a 10-second chunk finishes recording
- **THEN** Whisper processing SHALL complete within 5 seconds (total: 10s buffer + ~3s processing + ~1s delivery < 15s)
