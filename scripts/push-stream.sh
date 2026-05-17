#!/bin/bash
VIDEO="${1:-media/sports_clip.mp4}"

if [ ! -f "$VIDEO" ]; then
  echo "Error: $VIDEO not found"
  exit 1
fi

echo "Pushing $VIDEO to rtmp://localhost:1935/live/stream"
ffmpeg -re -i "$VIDEO" \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -c:a aac -ar 44100 \
  -f flv rtmp://localhost:1935/live/stream
