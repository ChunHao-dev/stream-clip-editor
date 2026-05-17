## ADDED Requirements

### Requirement: RTMP stream ingestion
The system SHALL accept RTMP streams via nginx-rtmp and convert them to HLS for frontend playback.

#### Scenario: Stream starts successfully
- **WHEN** ffmpeg pushes an RTMP stream to `rtmp://localhost:1935/live/stream`
- **THEN** nginx-rtmp SHALL produce an HLS playlist at `http://localhost:8080/hls/stream.m3u8` within 5 seconds

#### Scenario: Stream simulation from local file
- **WHEN** user runs the push-stream script with a local mp4 file
- **THEN** ffmpeg SHALL push the file in realtime (`-re` flag) to the RTMP endpoint

### Requirement: Docker-based deployment
The system SHALL run nginx-rtmp as a Docker container managed by Docker Compose.

#### Scenario: One-command startup
- **WHEN** user runs `docker-compose up`
- **THEN** nginx-rtmp SHALL be available on ports 1935 (RTMP) and 8080 (HLS)

### Requirement: HLS segment configuration
The system SHALL produce HLS segments suitable for near-realtime playback.

#### Scenario: Low-latency HLS
- **WHEN** nginx-rtmp converts RTMP to HLS
- **THEN** HLS segment duration SHALL be 2-4 seconds to minimize playback delay
