# Video Wall Project

Standalone website for running multiple video links on one page.

## What it does

- Accepts multiple video URLs
- Shows your project ID on the page
- Auto-runs direct video files, YouTube links, and Vimeo links
- Stores the last used values in the browser

## Local use

```powershell
cd video-wall-project
npm run build
npm start
```

Then open the local address shown by `serve`.

## Render setup

Create a new Static Site in Render using this folder:

- Root Directory: `video-wall-project`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`

Environment variables:

- `VIDEO_WALL_PROJECT_ID`
- `VIDEO_WALL_LINKS`

Example `VIDEO_WALL_LINKS` value:

```text
https://www.youtube.com/watch?v=dQw4w9WgXcQ,https://example.com/video.mp4
```

## Runtime overrides

You can also override values from the URL:

- `?projectId=abc123`
- `?links=https://example.com/a.mp4,https://example.com/b.mp4`
