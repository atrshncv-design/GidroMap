# GidroMap

An interactive editor for **hydroisohypse maps** (groundwater contour lines) — an applied geography research tool built with **Next.js + React + TypeScript**.

> **Status: experiment** — research tool, not a production service.

## Features

- Interactive hydroisohypse map editor (Next.js, repo root)
- Import a scanned map image (PNG/JPG/WEBP, etc.) directly in the UI
- Manual entry of elevation values at a selected point
- Batch import of point elevations from CSV/TXT/JSON
- Contour-line construction (brown), fills, and groundwater flow-direction arrows

## Key files

- `src/app/page.tsx` — editor logic and all tools
- `public/map-reference.png` — default base map layer
- `package.json` — build/run scripts

## Local run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

---

# GidroMap

Интерактивный редактор **карт гидроизогипс** (линий равных отметок уровня грунтовых вод) — прикладной исследовательский инструмент на **Next.js + React + TypeScript**.

> **Статус: experiment** — исследовательский инструмент, не production-сервис.

## Возможности

- Интерактивный редактор карты гидроизогипс (Next.js, корень репозитория)
- Импорт скана карты (PNG/JPG/WEBP и др.) прямо в интерфейсе
- Ручной ввод высот по выбранной точке
- Пакетный импорт высот точек из CSV/TXT/JSON
- Построение изолиний (коричневый цвет), заливки и стрелок направления стока

## Ключевые файлы

- `src/app/page.tsx` — основная логика редактора и всех инструментов
- `public/map-reference.png` — базовая подложка карты по умолчанию
- `package.json` — скрипты сборки/запуска

## Локальный запуск

```bash
npm install
npm run dev
```

Откройте `http://localhost:3000`.
