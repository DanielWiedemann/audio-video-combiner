# Audio Video Combiner TODO

## Core Features
- [x] File upload UI for audio and video files
- [x] Video looping logic to match audio duration
- [x] Video export to 1920x1080 MP4 format
- [x] Processing status and progress tracking
- [x] Download exported video

## Backend
- [x] FFmpeg integration for video processing
- [x] Audio duration detection
- [x] Video looping and concatenation
- [x] MP4 export with specified resolution
- [x] File storage and cleanup
- [x] Add background job processing queue
- [x] Add job progress tracking
- [x] Implement real-time progress updates via polling
- [ ] Implement actual file upload to S3 before processing

## Frontend
- [x] File upload UI
- [x] File validation (audio/video formats)
- [x] Processing status display with progress bar
- [x] Download button for completed video
- [x] Error handling and user feedback
- [x] Real-time job status updates
- [ ] Drag-and-drop file upload

## Bugs
- [x] Fix JSON parsing error - increased payload limit to 500MB
- [x] Fix database column size - changed to longtext for base64 data

## Deployment
- [x] Create GitHub repository
- [x] Push code to GitHub

