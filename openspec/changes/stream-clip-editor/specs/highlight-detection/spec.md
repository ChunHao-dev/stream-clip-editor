## ADDED Requirements

### Requirement: Volume spike detection
The system SHALL analyze each audio chunk for volume spikes indicating crowd cheering or excitement.

#### Scenario: Volume spike detected
- **WHEN** an audio chunk's peak loudness exceeds 2x the running average loudness
- **THEN** the system SHALL flag that chunk's time range as a volume spike event

#### Scenario: No spike
- **WHEN** an audio chunk's loudness is within normal range
- **THEN** no volume spike event SHALL be generated

### Requirement: Keyword detection from transcript
The system SHALL scan transcription results for configurable keywords indicating highlights.

#### Scenario: Keyword match found
- **WHEN** a transcript segment contains a configured keyword (e.g., "全壘打", "得分", "goal")
- **THEN** the system SHALL flag that segment's time range as a keyword event

### Requirement: Two-layer highlight scoring
The system SHALL combine volume spike and keyword signals to produce highlight candidates with confidence scores.

#### Scenario: Both signals triggered
- **WHEN** a time range has both a volume spike AND a keyword match
- **THEN** the system SHALL mark it as a high-confidence highlight

#### Scenario: Single signal triggered
- **WHEN** a time range has only a volume spike OR only a keyword match
- **THEN** the system SHALL mark it as a low-confidence highlight candidate

### Requirement: Volume-driven start/end boundaries
The system SHALL determine clip boundaries by analyzing the volume waveform around a highlight point.

#### Scenario: Start boundary detection
- **WHEN** a highlight point is identified
- **THEN** the system SHALL scan backwards to find where volume began rising (start point)

#### Scenario: End boundary detection
- **WHEN** a highlight point is identified
- **THEN** the system SHALL scan forwards to find where volume returns to baseline (end point)

### Requirement: Highlight delivery via WebSocket
The system SHALL push detected highlights to the frontend in realtime.

#### Scenario: Highlight notification
- **WHEN** a highlight is detected
- **THEN** the system SHALL emit a WebSocket message containing `{ start, end, confidence, reason, type }` to all connected clients
