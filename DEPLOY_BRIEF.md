# Deployment Brief For GidroMap

## 1. Project purpose

Interactive hydroisohypse map editor with:
- map scan import in UI
- manual height entry per selected point
- bulk import of point heights from CSV/TXT/JSON
- contour rendering (brown), fill zones, and groundwater flow arrows

## 2. Canonical files

Primary app logic:
- `src/app/page.tsx`

Default map underlay:
- `public/map-reference.png`

Runtime/build configuration:
- `package.json`
- `.zscripts/build.sh`
- `.zscripts/start.sh`

## 3. Deployment requirements

Deploy from repository root and keep this exact behavior:
1. Build command: `npm run build`
2. Runtime command: `npm run start`
3. Keep `public/map-reference.png` available at runtime
4. Keep import tools available in UI (scan import + heights import)

## 4. Local verification

1. Run `npm install`
2. Run `npm run build`
3. Run `npm run dev`
4. Open `http://localhost:3000` and verify:
   - map editor opens
   - scan import button works
   - manual point data save works
   - bulk heights import works
   - contour lines are brown

## 5. Publishing note

`main` must always point to this current map editor version.  
If a newer archive is imported in the future, update files and docs in one commit so repository downloads always match the intended map version.
