# Deployment Brief For GidroMap

## 1. Project purpose

Interactive hydroisohypse map editor with:
- manual point placement
- contour visualization
- filtration direction arrows
- export of rendered result

## 2. Canonical files

Main application:
- `src/app/page.tsx`

Core static reference:
- `public/map-reference.png`

## 3. Deployment requirements

This is a standard Next.js app.

Required behavior:
1. Deploy from repository root.
2. Build and run the current app version as-is.
3. Keep `public/map-reference.png` available at runtime.

## 4. Local verification

1. Run `npm install`
2. Run `npm run dev`
3. Open the app and verify that the hydroisohypse editor renders and the reference map is visible.

## 5. Publishing note

This repository should always represent this archive-based map-editor version unless explicitly updated with a newer archive.
