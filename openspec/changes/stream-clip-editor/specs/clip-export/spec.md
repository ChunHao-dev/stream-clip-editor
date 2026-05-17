## ADDED Requirements

### Requirement: Clip extraction API
The backend SHALL expose a POST endpoint to extract a clip from the stream source.

#### Scenario: Successful clip extraction
- **WHEN** the frontend POSTs `{ start: number, end: number }` to `/api/clips`
- **THEN** the backend SHALL use ffmpeg to extract the segment from the recorded stream and return `{ clipId, downloadUrl }`

#### Scenario: Invalid time range
- **WHEN** the request has `start >= end` or negative values
- **THEN** the backend SHALL return HTTP 400 with an error message

### Requirement: Stream recording for clip source
The backend SHALL continuously record the incoming stream to disk so clips can be extracted from any past time point.

#### Scenario: Recording active during stream
- **WHEN** a stream is active
- **THEN** the backend SHALL maintain a rolling recording file (mp4/ts) of the stream

### Requirement: Clip file serving
The backend SHALL serve generated clip files for download.

#### Scenario: Download clip
- **WHEN** the frontend requests the download URL returned from clip creation
- **THEN** the backend SHALL serve the mp4 file with appropriate Content-Disposition header
