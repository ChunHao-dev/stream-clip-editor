## ADDED Requirements

### Requirement: HLS stream playback
The frontend SHALL play the live HLS stream using hls.js.

#### Scenario: Stream loads and plays
- **WHEN** the frontend connects to the HLS endpoint
- **THEN** hls.js SHALL begin playing the live stream with < 5 second startup delay

### Requirement: Canvas timeline with AI markers
The frontend SHALL render a canvas-based timeline showing the stream progress and AI-detected highlight markers.

#### Scenario: Highlight marker appears
- **WHEN** the backend sends a highlight event via WebSocket
- **THEN** a colored marker SHALL appear on the timeline at the corresponding time position (high-confidence = red, low-confidence = yellow)

#### Scenario: Timeline tracks playback
- **WHEN** the stream is playing
- **THEN** the timeline playhead SHALL move in sync with the current playback time

### Requirement: Draggable in/out points
The frontend SHALL allow users to set and adjust clip start/end points on the timeline.

#### Scenario: Set in/out from AI suggestion
- **WHEN** user clicks an AI highlight marker
- **THEN** the in/out points SHALL be set to the highlight's start/end boundaries

#### Scenario: Manual drag adjustment
- **WHEN** user drags an in or out handle on the timeline
- **THEN** the corresponding time point SHALL update and display the new timestamp

### Requirement: Transcript display with click-to-seek
The frontend SHALL display the realtime transcript and allow clicking text to seek the player.

#### Scenario: Transcript updates in realtime
- **WHEN** a new transcript chunk arrives via WebSocket
- **THEN** the text SHALL append to the transcript panel with its timestamp

#### Scenario: Click to seek
- **WHEN** user clicks a transcript segment
- **THEN** the player SHALL seek to that segment's start time

### Requirement: Clip export request
The frontend SHALL allow users to submit a clip request with the selected in/out points.

#### Scenario: Submit clip
- **WHEN** user clicks "Export Clip" with valid in/out points set
- **THEN** the frontend SHALL POST `{ start, end }` to the clip API and display a download link when ready
