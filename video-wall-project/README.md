# Video Wall Project

Standalone website for running a camera-link video wall.

## What it does

- Supports up to 50 camera tiles in one wall
- Uses square tiles for showroom-style camera demos
- Accepts one line per camera with primary and backup sources
- Shows your project ID on the page
- Retries dropped streams automatically
- Switches to the next configured source when a stream fails or a clip ends
- Stores the last used values in the browser

## Camera format

Use one line per tile:

```text
Camera Name|primary-source|backup-source-1|backup-source-2
```

Example:

```text
Front Gate|https://nvr.example.com/frontgate.m3u8|https://backup.example.com/frontgate.m3u8
Showroom 1|https://nvr.example.com/showroom1.m3u8
Back Office|https://gateway.example.com/backoffice.mp4|https://backup.example.com/backoffice.mp4
```

## Best link type

Use your normal browser-playable camera website links whenever possible:

- HLS `.m3u8`
- MP4
- WebRTC streams

## RTSP note

If some cameras only give `rtsp://` links, browsers will not play those directly. Convert them through your NVR, stream gateway, or camera server into browser-playable URLs first.

## Local use

```powershell
cd video-wall-project
npm run build
npm start
```

Then open the local address shown by `serve`.

## Render setup

Create a new Static Site in Render using this folder:

- Root Directory: leave blank when using the dedicated `video-wall` repo
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

Environment variables:

- `VIDEO_WALL_PROJECT_ID`
- `VIDEO_WALL_LINKS`

Example `VIDEO_WALL_LINKS` value:

```text
Front Gate|https://nvr.example.com/frontgate.m3u8|https://backup.example.com/frontgate.m3u8
Showroom 1|https://nvr.example.com/showroom1.m3u8
```

## Runtime overrides

You can also override values from the URL:

- `?projectId=abc123`
- `?links=Front%20Gate|https://example.com/frontgate.m3u8`
