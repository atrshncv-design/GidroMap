'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { MapPin, Move, Trash2, Download, Check, Waves, Square, ArrowDownRight, Upload, FileUp } from 'lucide-react'

// Данные для варианта 10
const variant10Data = {
  boreholes: [
    { id: 1, absMouth: 88.3, depth: 4.3, waterLevel: 84.0 },
    { id: 2, absMouth: 92.1, depth: 6.1, waterLevel: 86.0 },
    { id: 3, absMouth: 90.8, depth: 5.3, waterLevel: 85.5 },
    { id: 4, absMouth: 83.0, depth: 2.2, waterLevel: 80.8 },
    { id: 8, absMouth: 91.5, depth: 5.6, waterLevel: 85.9 },
    { id: 9, absMouth: 91.0, depth: 5.0, waterLevel: 86.0 },
    { id: 10, absMouth: 84.9, depth: 3.4, waterLevel: 81.5 },
    { id: 16, absMouth: 88.2, depth: 3.2, waterLevel: 85.0 },
    { id: 17, absMouth: 83.1, depth: 2.1, waterLevel: 81.0 },
  ],
  shafts: [
    { id: 1, absMouth: 87.3, depth: 3.8, waterLevel: 83.5 },
    { id: 2, absMouth: 92.4, depth: 6.0, waterLevel: 86.4 },
    { id: 3, absMouth: 87.0, depth: 5.0, waterLevel: 82.0 },
    { id: 4, absMouth: 91.6, depth: 5.6, waterLevel: 86.0 },
  ],
}

interface Point {
  id: number
  type: 'borehole' | 'shaft' | 'custom'
  x: number
  y: number
  label: string
  waterLevel?: number
  absMouth?: number
  depth?: number
}

interface BoundaryPoint {
  x: number
  y: number
}

type ExclusionZone = BoundaryPoint[]

interface HeightImportRow {
  pointType?: Point['type']
  id?: number
  label?: string
  waterLevel: number
  absMouth?: number
  depth?: number
}

function parseDecimal(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return undefined
  const num = Number(normalized)
  return Number.isFinite(num) ? num : undefined
}

function normalizePointType(raw: unknown): Point['type'] | undefined {
  if (typeof raw !== 'string') return undefined
  const value = raw.trim().toLowerCase()
  if (!value) return undefined
  if (['borehole', 'скв', 'скв.', 'скважина', 'well'].includes(value)) return 'borehole'
  if (['shaft', 'шурф', 'shurf'].includes(value)) return 'shaft'
  if (['custom', 'точка', 'point'].includes(value)) return 'custom'
  return undefined
}

function isSamePoint(a: Point, b: Point): boolean {
  return a.type === b.type && a.id === b.id && a.label === b.label
}

function pointMatchesImportRow(point: Point, row: HeightImportRow): boolean {
  if (row.label) return point.label.trim().toLowerCase() === row.label.trim().toLowerCase()
  if (row.id === undefined) return false
  if (row.pointType) return point.type === row.pointType && point.id === row.id
  return point.id === row.id
}

function parseHeightImport(raw: string): { rows: HeightImportRow[]; errors: string[] } {
  const rows: HeightImportRow[] = []
  const errors: string[] = []
  const trimmed = raw.trim()

  if (!trimmed) return { rows, errors: ['Пустой ввод для импорта.'] }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const items = Array.isArray(parsed)
        ? parsed
        : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { points?: unknown[] }).points))
          ? (parsed as { points: unknown[] }).points
          : null

      if (!items) return { rows, errors: ['JSON должен быть массивом или объектом с полем points[].'] }

      items.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          errors.push(`Строка ${index + 1}: некорректный объект.`)
          return
        }
        const rowObj = item as Record<string, unknown>
        const waterLevel = parseDecimal(rowObj.waterLevel ?? rowObj.level ?? rowObj.height ?? rowObj.value)
        if (waterLevel === undefined) {
          errors.push(`Строка ${index + 1}: не найдено поле высоты (waterLevel/level/height/value).`)
          return
        }

        const id = parseDecimal(rowObj.id)
        const label = typeof rowObj.label === 'string' ? rowObj.label.trim() : undefined
        const pointType = normalizePointType(rowObj.type)
        if (id === undefined && !label) {
          errors.push(`Строка ${index + 1}: нужен id или label.`)
          return
        }

        rows.push({
          pointType,
          id,
          label,
          waterLevel,
          absMouth: parseDecimal(rowObj.absMouth),
          depth: parseDecimal(rowObj.depth),
        })
      })

      return { rows, errors }
    } catch {
      return { rows, errors: ['Некорректный JSON для импорта списка точек.'] }
    }
  }

  const lines = trimmed
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('//'))

  if (lines.length === 0) return { rows, errors: ['Не найдено строк с данными.'] }

  const headerPattern = /id|type|тип|water|level|уров|height|label|метк/i
  const dataLines = headerPattern.test(lines[0]) ? lines.slice(1) : lines

  dataLines.forEach((line, index) => {
    const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ','
    const parts = line.split(delimiter).map(part => part.trim())

    if (parts.length < 2) {
      errors.push(`Строка ${index + 1}: недостаточно колонок.`)
      return
    }

    let pointType: Point['type'] | undefined
    let id: number | undefined
    let label: string | undefined
    let waterLevel: number | undefined
    let absMouth: number | undefined
    let depth: number | undefined

    const firstAsType = normalizePointType(parts[0])
    const firstAsId = parseDecimal(parts[0])

    if (firstAsType) {
      pointType = firstAsType
      id = parseDecimal(parts[1])
      waterLevel = parseDecimal(parts[2])
      absMouth = parseDecimal(parts[3])
      depth = parseDecimal(parts[4])
      label = parts[5] || undefined
    } else if (firstAsId !== undefined) {
      id = firstAsId
      waterLevel = parseDecimal(parts[1])
      absMouth = parseDecimal(parts[2])
      depth = parseDecimal(parts[3])
      pointType = normalizePointType(parts[4])
      label = parts[5] || undefined
    } else {
      label = parts[0] || undefined
      waterLevel = parseDecimal(parts[1])
      pointType = normalizePointType(parts[2])
      id = parseDecimal(parts[3])
      absMouth = parseDecimal(parts[4])
      depth = parseDecimal(parts[5])
    }

    if (waterLevel === undefined) {
      errors.push(`Строка ${index + 1}: не удалось прочитать высоту.`)
      return
    }
    if (id === undefined && !label) {
      errors.push(`Строка ${index + 1}: нужен id или label.`)
      return
    }

    rows.push({ pointType, id, label, waterLevel, absMouth, depth })
  })

  return { rows, errors }
}

// Цвета для заливки по уровням
function getLevelColor(level: number, minLevel: number, maxLevel: number): string {
  // Нормализуем уровень от 0 до 1
  const normalized = (level - minLevel) / (maxLevel - minLevel)
  
  // Цветовая шкала от синего (низкий) к красному (высокий)
  // Используем интерполяцию HSL для плавного перехода
  const hue = (1 - normalized) * 240 // 240 = синий, 0 = красный
  return `hsl(${hue}, 70%, 60%)`
}

// Цвет для изолиний (коричневый)
function getContourColor(_level: number): string {
  return '#8b5a2b'
}

// Проверка, находится ли точка внутри полигона
function pointInPolygon(x: number, y: number, polygon: BoundaryPoint[]): boolean {
  if (polygon.length < 3) return true
  
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

// Проверка, находится ли точка внутри какой-либо зоны исключения
function pointInExclusionZone(x: number, y: number, exclusionZones: ExclusionZone[]): boolean {
  for (const zone of exclusionZones) {
    if (zone.length >= 3 && pointInPolygon(x, y, zone)) {
      return true
    }
  }
  return false
}

// Интерполяция IDW
function interpolateIDW(x: number, y: number, points: Array<{ x: number; y: number; value: number }>, power: number = 2): number {
  if (points.length === 0) return 0
  if (points.length === 1) return points[0].value

  let weightSum = 0, valueSum = 0

  for (const p of points) {
    const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2)
    if (dist < 0.001) return p.value
    const weight = 1 / Math.pow(dist, power)
    weightSum += weight
    valueSum += weight * p.value
  }

  return valueSum / weightSum
}

// Построение сетки значений с градиентами
function buildGrid(
  points: Array<{ x: number; y: number; value: number }>,
  boundary: BoundaryPoint[],
  resolution: number = 50,
  exclusionZones: ExclusionZone[] = []
): { grid: number[][], gradientX: number[][], gradientY: number[][], mask: boolean[][] } {
  const grid: number[][] = []
  const gradientX: number[][] = []
  const gradientY: number[][] = []
  const mask: boolean[][] = []
  const cellSize = 100 / resolution
  
  for (let j = 0; j <= resolution; j++) {
    const gridRow: number[] = []
    const gxRow: number[] = []
    const gyRow: number[] = []
    const maskRow: boolean[] = []
    
    for (let i = 0; i <= resolution; i++) {
      const x = (i / resolution) * 100
      const y = (j / resolution) * 100
      const insideBoundary = pointInPolygon(x, y, boundary)
      const insideExclusion = pointInExclusionZone(x, y, exclusionZones)
      const inside = insideBoundary && !insideExclusion
      maskRow.push(inside)
      
      if (inside) {
        const value = interpolateIDW(x, y, points)
        gridRow.push(value)
        
        // Вычисляем градиент (направление уклона)
        const valueXplus = interpolateIDW(x + cellSize, y, points)
        const valueYplus = interpolateIDW(x, y + cellSize, points)
        gxRow.push((valueXplus - value) / cellSize) // dx/dz
        gyRow.push((valueYplus - value) / cellSize) // dy/dz
      } else {
        gridRow.push(NaN)
        gxRow.push(NaN)
        gyRow.push(NaN)
      }
    }
    grid.push(gridRow)
    gradientX.push(gxRow)
    gradientY.push(gyRow)
    mask.push(maskRow)
  }
  
  return { grid, gradientX, gradientY, mask }
}

// Алгоритм Marching Squares с поддержкой границ
function marchingSquares(
  grid: number[][],
  mask: boolean[][],
  level: number,
  resolution: number
): Array<Array<{ x: number; y: number }>> {
  const contours: Array<Array<{ x: number; y: number }>> = []
  const edges: Map<string, { x: number; y: number }> = new Map()
  const cellSize = 100 / resolution
  
  const interpolate = (x1: number, y1: number, v1: number, x2: number, y2: number, v2: number) => {
    if (Math.abs(v2 - v1) < 0.0001) return { x: x1, y: y1 }
    const t = (level - v1) / (v2 - v1)
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) }
  }

  // Обрабатываем все ячейки сетки
  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const tlMask = mask[j][i], trMask = mask[j][i + 1]
      const brMask = mask[j + 1][i + 1], blMask = mask[j + 1][i]
      
      // Пропускаем ячейки полностью вне маски
      if (!tlMask && !trMask && !blMask && !brMask) continue
      
      const tl = grid[j][i], tr = grid[j][i + 1]
      const br = grid[j + 1][i + 1], bl = grid[j + 1][i]
      
      const realX = i * cellSize, realY = j * cellSize
      
      // Верхнее ребро
      if (tlMask && trMask && !isNaN(tl) && !isNaN(tr)) {
        if ((tl < level && tr >= level) || (tl >= level && tr < level)) {
          const pt = interpolate(realX, realY, tl, realX + cellSize, realY, tr)
          edges.set(`${i},${j}-top`, pt)
        }
      }
      
      // Правое ребро
      if (trMask && brMask && !isNaN(tr) && !isNaN(br)) {
        if ((tr < level && br >= level) || (tr >= level && br < level)) {
          const pt = interpolate(realX + cellSize, realY, tr, realX + cellSize, realY + cellSize, br)
          edges.set(`${i},${j}-right`, pt)
        }
      }
      
      // Нижнее ребро
      if (blMask && brMask && !isNaN(bl) && !isNaN(br)) {
        if ((bl < level && br >= level) || (bl >= level && br < level)) {
          const pt = interpolate(realX, realY + cellSize, bl, realX + cellSize, realY + cellSize, br)
          edges.set(`${i},${j}-bottom`, pt)
        }
      }
      
      // Левое ребро
      if (tlMask && blMask && !isNaN(tl) && !isNaN(bl)) {
        if ((tl < level && bl >= level) || (tl >= level && bl < level)) {
          const pt = interpolate(realX, realY, tl, realX, realY + cellSize, bl)
          edges.set(`${i},${j}-left`, pt)
        }
      }
      
      // Граничные рёбра (где маска переходит от true к false)
      // Верхняя граница ячейки на границе маски
      if (tlMask !== trMask && !isNaN(tl) && !isNaN(tr)) {
        if ((tl < level && tr >= level) || (tl >= level && tr < level)) {
          const pt = interpolate(realX, realY, tl, realX + cellSize, realY, tr)
          edges.set(`${i},${j}-top`, pt)
        }
      }
      
      // Правая граница ячейки на границе маски
      if (trMask !== brMask && !isNaN(tr) && !isNaN(br)) {
        if ((tr < level && br >= level) || (tr >= level && br < level)) {
          const pt = interpolate(realX + cellSize, realY, tr, realX + cellSize, realY + cellSize, br)
          edges.set(`${i},${j}-right`, pt)
        }
      }
      
      // Нижняя граница ячейки на границе маски
      if (blMask !== brMask && !isNaN(bl) && !isNaN(br)) {
        if ((bl < level && br >= level) || (bl >= level && br < level)) {
          const pt = interpolate(realX, realY + cellSize, bl, realX + cellSize, realY + cellSize, br)
          edges.set(`${i},${j}-bottom`, pt)
        }
      }
      
      // Левая граница ячейки на границе маски
      if (tlMask !== blMask && !isNaN(tl) && !isNaN(bl)) {
        if ((tl < level && bl >= level) || (tl >= level && bl < level)) {
          const pt = interpolate(realX, realY, tl, realX, realY + cellSize, bl)
          edges.set(`${i},${j}-left`, pt)
        }
      }
    }
  }

  // Соединяем точки в линии
  const connectPoints = (startKey: string) => {
    const line: Array<{ x: number; y: number }> = []
    let currentKey = startKey
    
    while (edges.has(currentKey)) {
      line.push(edges.get(currentKey)!)
      edges.delete(currentKey)
      
      const [iStr, jStr] = currentKey.split(/[-,]/)
      const i = parseInt(iStr), j = parseInt(jStr)
      
      // Ищем соседние рёбра (расширенный поиск)
      const neighbors = [
        `${i},${j}-top`, `${i},${j}-right`, `${i},${j}-bottom`, `${i},${j}-left`,
        `${i-1},${j}-right`, `${i+1},${j}-left`, `${i},${j-1}-bottom`, `${i},${j+1}-top`,
      ]
      
      let found = false
      for (const n of neighbors) {
        if (edges.has(n)) { currentKey = n; found = true; break }
      }
      if (!found) break
    }
    return line.length > 0 ? line : null
  }

  for (const [key] of Array.from(edges.entries())) {
    const line = connectPoints(key)
    if (line && line.length > 1) contours.push(line)
  }

  return contours
}

// Генерация заливки для зон высот
function generateFillRects(
  grid: number[][],
  mask: boolean[][],
  resolution: number,
  levels: number[]
): Array<{ x: number; y: number; w: number; h: number; color: string }> {
  const rects: Array<{ x: number; y: number; w: number; h: number; color: string }> = []
  const cellSize = 100 / resolution
  const minLevel = Math.min(...levels)
  const maxLevel = Math.max(...levels)
  
  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      if (!mask[j][i]) continue
      
      const val = grid[j][i]
      if (isNaN(val)) continue
      
      const color = getLevelColor(val, minLevel, maxLevel)
      rects.push({
        x: i * cellSize,
        y: j * cellSize,
        w: cellSize,
        h: cellSize,
        color
      })
    }
  }
  
  return rects
}

// Генерация стрелок уклона
function generateFlowArrows(
  gradientX: number[][],
  gradientY: number[][],
  mask: boolean[][],
  resolution: number,
  density: number = 8
): Array<{ x: number; y: number; dx: number; dy: number }> {
  const arrows: Array<{ x: number; y: number; dx: number; dy: number }> = []
  const step = Math.floor(resolution / density)
  
  for (let j = step; j < resolution; j += step) {
    for (let i = step; i < resolution; i += step) {
      if (!mask[j][i]) continue
      
      const gx = gradientX[j][i]
      const gy = gradientY[j][i]
      
      if (isNaN(gx) || isNaN(gy)) continue
      
      // Вычисляем направление уклона (от высокого к низкому)
      const magnitude = Math.sqrt(gx * gx + gy * gy)
      if (magnitude < 0.0001) continue
      
      // Направление потока = направление убывания
      const dx = -gx / magnitude
      const dy = -gy / magnitude
      
      const x = (i / resolution) * 100
      const y = (j / resolution) * 100
      
      // Длина стрелки пропорциональна уклону
      const arrowLength = Math.min(4, magnitude * 100)
      
      arrows.push({
        x,
        y,
        dx: dx * arrowLength,
        dy: dy * arrowLength
      })
    }
  }
  
  return arrows
}

function contoursToSvgPath(contours: Array<Array<{ x: number; y: number }>>): string {
  return contours
    .map(line => {
      if (line.length < 2) return ''
      const [first, ...rest] = line
      return `M ${first.x.toFixed(2)} ${first.y.toFixed(2)} ` + 
        rest.map(pt => `L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`).join(' ')
    })
    .filter(p => p)
    .join(' ')
}

function getInitialPoints(): Point[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem('mapPoints')
    return saved ? JSON.parse(saved) : []
  } catch { return [] }
}

function getInitialBoundary(): BoundaryPoint[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem('mapBoundary')
    return saved ? JSON.parse(saved) : []
  } catch { return [] }
}

function getInitialExclusionZones(): ExclusionZone[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem('exclusionZones')
    return saved ? JSON.parse(saved) : []
  } catch { return [] }
}

function getInitialId(type: 'borehole' | 'shaft'): number {
  if (typeof window === 'undefined') return 1
  try {
    const saved = localStorage.getItem('mapPoints')
    if (saved) {
      const parsed: Point[] = JSON.parse(saved)
      const ids = parsed.filter(p => p.type === type).map(p => p.id)
      return Math.max(1, ...ids) + 1
    }
  } catch {}
  return 1
}

export default function MapEditor() {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageWrapperRef = useRef<HTMLDivElement>(null)
  const mapScanInputRef = useRef<HTMLInputElement>(null)
  const heightsInputRef = useRef<HTMLInputElement>(null)
  const [points, setPoints] = useState<Point[]>(getInitialPoints)
  const [boundary, setBoundary] = useState<BoundaryPoint[]>(getInitialBoundary)
  const [exclusionZones, setExclusionZones] = useState<ExclusionZone[]>(getInitialExclusionZones)
  const [currentExclusionZone, setCurrentExclusionZone] = useState<BoundaryPoint[]>([])
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null)
  const [draggingPoint, setDraggingPoint] = useState<Point | null>(null)
  const [mode, setMode] = useState<'add-borehole' | 'add-shaft' | 'move' | 'delete' | 'boundary' | 'exclusion'>('move')
  const [nextBoreholeId, setNextBoreholeId] = useState(() => getInitialId('borehole'))
  const [nextShaftId, setNextShaftId] = useState(() => getInitialId('shaft'))
  const [imageLoaded, setImageLoaded] = useState(false)
  const [showContours, setShowContours] = useState(true)
  const [showFill, setShowFill] = useState(true)
  const [showArrows, setShowArrows] = useState(true)
  const [contourInterval, setContourInterval] = useState(1)
  const [mapImageSrc, setMapImageSrc] = useState('/map-reference.png')
  const [mapImageName, setMapImageName] = useState('map-reference.png')
  const [manualWaterLevel, setManualWaterLevel] = useState('')
  const [manualAbsMouth, setManualAbsMouth] = useState('')
  const [manualDepth, setManualDepth] = useState('')
  const [manualEditStatus, setManualEditStatus] = useState('')
  const [bulkHeightsText, setBulkHeightsText] = useState('')
  const [bulkImportStatus, setBulkImportStatus] = useState('')

  useEffect(() => { localStorage.setItem('mapPoints', JSON.stringify(points)) }, [points])
  useEffect(() => { localStorage.setItem('mapBoundary', JSON.stringify(boundary)) }, [boundary])
  useEffect(() => { localStorage.setItem('exclusionZones', JSON.stringify(exclusionZones)) }, [exclusionZones])
  useEffect(() => {
    if (!selectedPoint) return
    const freshPoint = points.find(point => isSamePoint(point, selectedPoint))
    if (!freshPoint) {
      setSelectedPoint(null)
      return
    }
    if (freshPoint !== selectedPoint) setSelectedPoint(freshPoint)
  }, [points, selectedPoint])
  useEffect(() => {
    if (!selectedPoint) {
      setManualWaterLevel('')
      setManualAbsMouth('')
      setManualDepth('')
      return
    }
    setManualWaterLevel(selectedPoint.waterLevel?.toString() ?? '')
    setManualAbsMouth(selectedPoint.absMouth?.toString() ?? '')
    setManualDepth(selectedPoint.depth?.toString() ?? '')
  }, [selectedPoint])

  const updateFromVariant10 = () => {
    setPoints(points.map(point => {
      if (point.type === 'borehole') {
        const data = variant10Data.boreholes.find(d => d.id === point.id)
        return data ? { ...point, ...data } : point
      } else if (point.type === 'shaft') {
        const data = variant10Data.shafts.find(d => d.id === point.id)
        return data ? { ...point, ...data } : point
      }
      return point
    }))
  }

  const handleImageLoad = () => setImageLoaded(true)

  const handleMapScanImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Выберите файл изображения (PNG, JPG, WEBP и т.д.).')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setMapImageSrc(reader.result)
      setMapImageName(file.name)
      setImageLoaded(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const resetMapScan = () => {
    setMapImageSrc('/map-reference.png')
    setMapImageName('map-reference.png')
    setImageLoaded(false)
  }

  const getCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const img = imageWrapperRef.current
    if (!img) return null
    const rect = img.getBoundingClientRect()
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * 10000) / 100,
      y: Math.round(((e.clientY - rect.top) / rect.height) * 10000) / 100
    }
  }

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingPoint || mode === 'move') return
    const coords = getCoords(e)
    if (!coords) return

    if (mode === 'boundary') {
      setBoundary([...boundary, coords])
    } else if (mode === 'exclusion') {
      setCurrentExclusionZone([...currentExclusionZone, coords])
    } else if (mode === 'add-borehole') {
      const data = variant10Data.boreholes.find(d => d.id === nextBoreholeId)
      setPoints([...points, { id: nextBoreholeId, type: 'borehole', ...coords, label: `Скв. ${nextBoreholeId}`, ...data }])
      setNextBoreholeId(nextBoreholeId + 1)
    } else if (mode === 'add-shaft') {
      const data = variant10Data.shafts.find(d => d.id === nextShaftId)
      setPoints([...points, { id: nextShaftId, type: 'shaft', ...coords, label: `Шурф ${nextShaftId}`, ...data }])
      setNextShaftId(nextShaftId + 1)
    } else if (mode === 'delete') {
      const clicked = points.find(p => Math.abs(p.x - coords.x) < 2 && Math.abs(p.y - coords.y) < 2)
      if (clicked) {
        setPoints(points.filter(p => !isSamePoint(p, clicked)))
        if (selectedPoint && isSamePoint(selectedPoint, clicked)) setSelectedPoint(null)
      }
    }
  }

  const handlePointMouseDown = (e: React.MouseEvent, point: Point) => {
    e.stopPropagation()
    setSelectedPoint(point)
    if (mode === 'move') setDraggingPoint(point)
    else if (mode === 'delete') {
      setPoints(points.filter(p => !isSamePoint(p, point)))
      setSelectedPoint(null)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingPoint) return
    const coords = getCoords(e)
    if (!coords) return
    const nextX = Math.max(0, Math.min(100, coords.x))
    const nextY = Math.max(0, Math.min(100, coords.y))
    setPoints(points.map(p => 
      isSamePoint(p, draggingPoint) ? { ...p, x: nextX, y: nextY } : p
    ))
    setDraggingPoint({ ...draggingPoint, x: nextX, y: nextY })
  }

  const handleMouseUp = () => setDraggingPoint(null)

  const exportCoordinates = () => {
    const data = { points, boundary, exclusionZones }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'map-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearAll = () => {
    if (confirm('Удалить все точки, границы и зоны исключения?')) {
      setPoints([]); setBoundary([]); setExclusionZones([]); setSelectedPoint(null)
      setNextBoreholeId(1); setNextShaftId(1)
    }
  }

  const clearBoundary = () => setBoundary([])
  const finishExclusionZone = () => {
    if (currentExclusionZone.length >= 3) {
      setExclusionZones([...exclusionZones, currentExclusionZone])
      setCurrentExclusionZone([])
    }
  }
  const cancelExclusionZone = () => setCurrentExclusionZone([])
  const clearExclusionZones = () => setExclusionZones([])
  const deleteLastExclusionZone = () => setExclusionZones(exclusionZones.slice(0, -1))

  const addCustomPoint = (type: 'pointA' | 'pointB') => {
    setPoints([...points, { id: type === 'pointA' ? 0 : 1, type: 'custom', x: 50, y: 50, label: type === 'pointA' ? 'А' : 'Б' }])
  }

  const applySelectedPointLevels = () => {
    if (!selectedPoint) return

    const waterLevel = manualWaterLevel.trim() === '' ? undefined : parseDecimal(manualWaterLevel)
    const absMouth = manualAbsMouth.trim() === '' ? undefined : parseDecimal(manualAbsMouth)
    const depth = manualDepth.trim() === '' ? undefined : parseDecimal(manualDepth)

    if (manualWaterLevel.trim() !== '' && waterLevel === undefined) {
      setManualEditStatus('Ошибка: высота уровня задана некорректно.')
      return
    }
    if (manualAbsMouth.trim() !== '' && absMouth === undefined) {
      setManualEditStatus('Ошибка: абсолютная отметка устья задана некорректно.')
      return
    }
    if (manualDepth.trim() !== '' && depth === undefined) {
      setManualEditStatus('Ошибка: глубина задана некорректно.')
      return
    }

    setPoints(points.map(point => (
      isSamePoint(point, selectedPoint)
        ? { ...point, waterLevel, absMouth, depth }
        : point
    )))
    setManualEditStatus(`Данные точки "${selectedPoint.label}" обновлены.`)
  }

  const applyHeightRows = (rawText: string) => {
    const { rows, errors } = parseHeightImport(rawText)
    if (rows.length === 0) {
      setBulkImportStatus(errors.join(' '))
      return
    }

    const nextPoints = [...points]
    let updated = 0
    let notFound = 0
    let ambiguous = 0

    for (const row of rows) {
      const matchedPoints = nextPoints.filter(point => pointMatchesImportRow(point, row))
      if (matchedPoints.length === 1) {
        const targetPoint = matchedPoints[0]
        const index = nextPoints.findIndex(point => isSamePoint(point, targetPoint))
        if (index >= 0) {
          nextPoints[index] = {
            ...nextPoints[index],
            waterLevel: row.waterLevel,
            absMouth: row.absMouth ?? nextPoints[index].absMouth,
            depth: row.depth ?? nextPoints[index].depth,
          }
          updated += 1
        }
      } else if (matchedPoints.length === 0) {
        notFound += 1
      } else {
        ambiguous += 1
      }
    }

    setPoints(nextPoints)
    const problems = [...errors]
    if (notFound > 0) problems.push(`Не найдено: ${notFound}.`)
    if (ambiguous > 0) problems.push(`Неоднозначно (дубли id без type): ${ambiguous}.`)
    setBulkImportStatus(`Импортировано: ${updated}/${rows.length}. ${problems.join(' ')}`.trim())
  }

  const handleHeightsFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setBulkHeightsText(text)
      applyHeightRows(text)
    } catch {
      setBulkImportStatus('Не удалось прочитать файл импорта.')
    } finally {
      e.target.value = ''
    }
  }

  // Расчёт данных
  const { contours, fillRects, arrows, minLevel, maxLevel } = useMemo(() => {
    const pointsWithLevel = points.filter(p => p.waterLevel !== undefined)
    if (pointsWithLevel.length < 3) return { contours: [], fillRects: [], arrows: [], minLevel: 0, maxLevel: 0 }

    const minL = Math.floor(Math.min(...pointsWithLevel.map(p => p.waterLevel!)))
    const maxL = Math.ceil(Math.max(...pointsWithLevel.map(p => p.waterLevel!)))
    
    const dataPoints = pointsWithLevel.map(p => ({ x: p.x, y: p.y, value: p.waterLevel! }))
    const effectiveBoundary = boundary.length >= 3 ? boundary : [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }
    ]

    const resolution = 50
    const { grid, gradientX, gradientY, mask } = buildGrid(dataPoints, effectiveBoundary, resolution, exclusionZones)

    // Генерируем уровни
    const levels: number[] = []
    for (let l = minL; l <= maxL; l += contourInterval) levels.push(l)

    // Заливка зон
    const fillData = generateFillRects(grid, mask, resolution, levels)

    // Изолинии
    const contourData = levels.map(level => {
      const contourLines = marchingSquares(grid, mask, level, resolution)
      return { level, path: contoursToSvgPath(contourLines), color: getContourColor(level) }
    }).filter(c => c.path)

    // Стрелки уклона
    const arrowsData = generateFlowArrows(gradientX, gradientY, mask, resolution, 6)

    return { contours: contourData, fillRects: fillData, arrows: arrowsData, minLevel: minL, maxLevel: maxL }
  }, [points, boundary, exclusionZones, contourInterval])

  const pointsWithData = points.filter(p => p.waterLevel !== undefined)
  const boundaryPath = boundary.length >= 2 ? `M ${boundary.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')}` : ''

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Редактор карты гидроизогипс</h1>
          <p className="text-slate-600">Кликайте на карту для расстановки точек. Вариант 10.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <Card className="shadow-lg">
              <CardContent className="p-4">
                {/* Toolbar */}
                <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
                  <Button variant={mode === 'move' ? 'default' : 'outline'} size="sm" onClick={() => setMode('move')}>
                    <Move className="h-4 w-4 mr-1" /> Перемещение
                  </Button>
                  <Button variant={mode === 'add-borehole' ? 'default' : 'outline'} size="sm" onClick={() => setMode('add-borehole')}>
                    <span className="w-4 h-4 mr-1 flex items-center justify-center">○</span> Скважина #{nextBoreholeId}
                  </Button>
                  <Button variant={mode === 'add-shaft' ? 'default' : 'outline'} size="sm" onClick={() => setMode('add-shaft')}>
                    <span className="w-4 h-4 mr-1 flex items-center justify-center">□</span> Шурф #{nextShaftId}
                  </Button>
                  <Button variant={mode === 'boundary' ? 'destructive' : 'outline'} size="sm" onClick={() => setMode('boundary')}>
                    <Square className="h-4 w-4 mr-1" /> Граница
                  </Button>
                  <Button variant={mode === 'exclusion' ? 'destructive' : 'outline'} size="sm" onClick={() => setMode('exclusion')}>
                    <span className="w-4 h-4 mr-1 flex items-center justify-center">✕</span> Исключение
                  </Button>
                  <Button variant={mode === 'delete' ? 'destructive' : 'outline'} size="sm" onClick={() => setMode('delete')}>
                    <Trash2 className="h-4 w-4 mr-1" /> Удалить
                  </Button>
                  <Separator orientation="vertical" className="h-8" />
                  <Button variant="outline" size="sm" onClick={updateFromVariant10}>
                    <Check className="h-4 w-4 mr-1" /> Данные
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportCoordinates}>
                    <Download className="h-4 w-4 mr-1" /> Экспорт
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => mapScanInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1" /> Импорт скана
                  </Button>
                  {mapImageSrc !== '/map-reference.png' && (
                    <Button variant="outline" size="sm" onClick={resetMapScan}>Базовая карта</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={clearAll}>Очистить</Button>
                  <input
                    ref={mapScanInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleMapScanImport}
                  />
                </div>

                {/* Display Controls */}
                <div className="flex flex-wrap gap-4 mb-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Switch id="showFill" checked={showFill} onCheckedChange={setShowFill} />
                    <Label htmlFor="showFill" className="flex items-center gap-1 cursor-pointer">
                      <span className="h-4 w-4 rounded bg-gradient-to-r from-blue-500 to-red-500"></span> Заливка
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="showContours" checked={showContours} onCheckedChange={setShowContours} />
                    <Label htmlFor="showContours" className="flex items-center gap-1 cursor-pointer">
                      <Waves className="h-4 w-4 text-amber-800" /> Изолинии
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="showArrows" checked={showArrows} onCheckedChange={setShowArrows} />
                    <Label htmlFor="showArrows" className="flex items-center gap-1 cursor-pointer">
                      <ArrowDownRight className="h-4 w-4 text-red-600" /> Уклон
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Шаг:</Label>
                    <select className="text-sm border rounded px-2 py-1" value={contourInterval} onChange={(e) => setContourInterval(Number(e.target.value))}>
                      <option value={0.5}>0.5 м</option>
                      <option value={1}>1 м</option>
                      <option value={2}>2 м</option>
                    </select>
                  </div>
                  {contours.length > 0 && <Badge variant="secondary">{contours.length} изолиний</Badge>}
                  <Badge variant="outline" className="max-w-[230px] truncate">Скан: {mapImageName}</Badge>
                  {boundary.length > 0 && (
                    <>
                      <Badge variant="outline" className="border-red-500 text-red-600">Граница: {boundary.length} т.</Badge>
                      <Button variant="outline" size="sm" onClick={clearBoundary} className="text-red-600 text-xs">Сбросить</Button>
                    </>
                  )}
                  {exclusionZones.length > 0 && (
                    <>
                      <Badge variant="outline" className="border-purple-500 text-purple-600">Исключения: {exclusionZones.length}</Badge>
                      <Button variant="outline" size="sm" onClick={deleteLastExclusionZone} className="text-purple-600 text-xs">Удалить посл.</Button>
                      <Button variant="outline" size="sm" onClick={clearExclusionZones} className="text-purple-600 text-xs">Очистить</Button>
                    </>
                  )}
                </div>

                {/* Exclusion Zone Controls */}
                {mode === 'exclusion' && (
                  <div className="flex flex-wrap gap-2 mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <span className="text-sm text-purple-700 font-medium">Рисование зоны исключения:</span>
                    <Badge variant="outline" className="border-purple-400 text-purple-600">Точек: {currentExclusionZone.length}</Badge>
                    <Button variant="default" size="sm" onClick={finishExclusionZone} disabled={currentExclusionZone.length < 3}>Завершить зону</Button>
                    <Button variant="outline" size="sm" onClick={cancelExclusionZone} disabled={currentExclusionZone.length === 0}>Отмена</Button>
                    <span className="text-xs text-purple-600">Кликните на карту для добавления точек (мин. 3 точки)</span>
                  </div>
                )}

                {/* Map */}
                <div ref={containerRef} className="relative border-2 border-slate-300 rounded-lg overflow-auto cursor-crosshair bg-white"
                  style={{ maxHeight: '65vh' }} onClick={handleMapClick} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                  <div ref={imageWrapperRef} className="map-image-container relative inline-block min-w-full">
                    <img src={mapImageSrc} alt={`Карта (${mapImageName})`} className="block max-w-none pointer-events-none"
                      style={{ width: '100%', minWidth: '800px', maxWidth: '1200px' }} onLoad={handleImageLoad} draggable={false} />

                    {imageLoaded && (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Заливка зон высот */}
                        {showFill && fillRects.map((rect, i) => (
                          <rect key={`fill-${i}`} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={rect.color} opacity={0.6} />
                        ))}
                        
                        {/* Зоны исключения (заливка) */}
                        {exclusionZones.map((zone, zi) => {
                          const path = `M ${zone.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`
                          return <path key={`ex-fill-${zi}`} d={path} fill="rgba(139, 92, 246, 0.15)" stroke="none" />
                        })}
                        
                        {/* Граница */}
                        {boundaryPath && <path d={boundaryPath} fill="none" stroke="#dc2626" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
                        {boundary.map((pt, i) => <circle key={`b-${i}`} cx={pt.x} cy={pt.y} r="1.5" fill="#dc2626" />)}
                        
                        {/* Текущая зона исключения */}
                        {currentExclusionZone.length > 0 && (
                          <>
                            <path 
                              d={`M ${currentExclusionZone.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')}${currentExclusionZone.length >= 3 ? ' Z' : ''}`} 
                              fill={currentExclusionZone.length >= 3 ? 'rgba(139, 92, 246, 0.3)' : 'none'} 
                              stroke="#8b5cf6" 
                              strokeWidth="1.5" 
                              strokeDasharray="2,2"
                              vectorEffect="non-scaling-stroke" 
                            />
                            {currentExclusionZone.map((pt, i) => (
                              <circle key={`ce-${i}`} cx={pt.x} cy={pt.y} r="1.5" fill="#8b5cf6" />
                            ))}
                          </>
                        )}
                        
                        {/* Зоны исключения (границы) */}
                        {exclusionZones.map((zone, zi) => {
                          const path = `M ${zone.map(p => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L ')} Z`
                          return (
                            <g key={`ex-${zi}`}>
                              <path d={path} fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="3,2" vectorEffect="non-scaling-stroke" />
                              {zone.map((pt, pi) => (
                                <circle key={`ex-pt-${zi}-${pi}`} cx={pt.x} cy={pt.y} r="1" fill="#8b5cf6" />
                              ))}
                            </g>
                          )
                        })}
                        
                        {/* Стрелки уклона */}
                        {showArrows && arrows.map((a, i) => (
                          <g key={`arrow-${i}`} transform={`translate(${a.x}, ${a.y})`}>
                            <line x1="0" y1="0" x2={a.dx} y2={a.dy} stroke="#dc2626" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                            <polygon points={`${a.dx},${a.dy} ${a.dx-1.5},${a.dy-0.5} ${a.dx-0.5},${a.dy-1.5}`} fill="#dc2626" />
                          </g>
                        ))}
                        
                        {/* Изолинии */}
                        {showContours && contours.map((c, i) => (
                          <path key={`c-${i}`} d={c.path} fill="none" stroke={c.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                        ))}
                      </svg>
                    )}

                    {/* Points */}
                    {imageLoaded && points.map((point) => {
                      const isSelected = selectedPoint ? isSamePoint(selectedPoint, point) : false
                      return (
                        <div key={`${point.type}-${point.id}`}
                          className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer ${isSelected ? 'ring-2 ring-yellow-400 rounded-full' : ''}`}
                          style={{ left: `${point.x}%`, top: `${point.y}%` }}
                          onMouseDown={(e) => handlePointMouseDown(e, point)}>
                          {point.type === 'borehole' && (
                            <div className="relative">
                              <div className={`w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center ${point.waterLevel ? 'border-blue-600' : 'border-gray-400'}`}>
                                <div className={`w-2 h-2 rounded-full ${point.waterLevel ? 'bg-blue-600' : 'bg-gray-400'}`} />
                              </div>
                              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-blue-700">{point.id}</div>
                              {point.waterLevel && <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-blue-600 font-semibold">{point.waterLevel.toFixed(1)}</div>}
                            </div>
                          )}
                          {point.type === 'shaft' && (
                            <div className="relative">
                              <div className={`w-5 h-5 border-2 bg-white ${point.waterLevel ? 'border-green-600' : 'border-gray-400'}`}>
                                <div className="w-full h-0.5 bg-green-600 absolute top-1/2 left-0 -translate-y-1/2 rotate-45 origin-center" style={{ width: '141%' }} />
                                <div className="w-full h-0.5 bg-green-600 absolute top-1/2 left-0 -translate-y-1/2 -rotate-45 origin-center" style={{ width: '141%' }} />
                              </div>
                              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-green-700">Ш{point.id}</div>
                              {point.waterLevel && <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-green-600 font-semibold">{point.waterLevel.toFixed(1)}</div>}
                            </div>
                          )}
                          {point.type === 'custom' && (
                            <div className="w-6 h-6 rounded-full bg-yellow-100 border-2 border-yellow-500 flex items-center justify-center">
                              <span className="text-xs font-bold text-yellow-700">{point.label}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Instructions */}
                <div className="mt-4 text-sm text-slate-600 bg-blue-50 p-3 rounded-lg">
                  <strong>Инструкция:</strong>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li><strong>Импорт скана:</strong> в панели инструментов загрузите своё изображение карты</li>
                    <li><strong>Граница:</strong> кликните по углам карты для создания внешней рамки расчёта</li>
                    <li><strong>Исключение:</strong> нарисуйте зоны внутри карты, где нет данных (изолинии там не строятся)</li>
                    <li>Расставьте скважины и шурфы на карте</li>
                    <li><strong>Ввод высот:</strong> вручную в карточке точки или пакетно через импорт списка</li>
                    <li><strong>Красные стрелки</strong> показывают направление стока подземных вод</li>
                  </ol>
                  <div className="mt-2 flex gap-4">
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-0.5 bg-red-500"></div>
                      <span>Внешняя граница</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-0.5 bg-purple-500 border-dashed"></div>
                      <span>Зона исключения</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Легенда заливки */}
            {fillRects.length > 0 && minLevel !== maxLevel && (
              <Card className="shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="h-5 w-5 rounded bg-gradient-to-r from-blue-500 to-red-500"></span> 
                    Шкала высот
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-4 rounded overflow-hidden mb-2">
                    <div className="absolute inset-0" style={{
                      background: `linear-gradient(to right, hsl(240, 70%, 60%), hsl(180, 70%, 60%), hsl(120, 70%, 60%), hsl(60, 70%, 60%), hsl(0, 70%, 60%))`
                    }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{minLevel.toFixed(1)} м</span>
                    <span>{((minLevel + maxLevel) / 2).toFixed(1)} м</span>
                    <span>{maxLevel.toFixed(1)} м</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Синий — низкий уровень, красный — высокий</p>
                </CardContent>
              </Card>
            )}

            {contours.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Waves className="h-5 w-5 text-amber-800" /> Изолинии
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {contours.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-1 rounded" style={{ backgroundColor: c.color }} />
                        <span>{c.level.toFixed(1)} м</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownRight className="h-5 w-5 text-red-600" /> Направление стока
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-600">
                <p>Красные стрелки показывают направление движения подземных вод — от областей с высоким уровнем к областям с низким.</p>
                <div className="mt-2 flex items-center gap-2">
                  <svg width="40" height="20" viewBox="0 0 40 20">
                    <line x1="5" y1="10" x2="30" y2="10" stroke="#dc2626" strokeWidth="2" />
                    <polygon points="30,10 25,7 25,13" fill="#dc2626" />
                  </svg>
                  <span>Направление потока</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" /> Выбранная точка
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPoint ? (
                  <div className="space-y-3">
                    <Badge variant={selectedPoint.type === 'borehole' ? 'default' : 'secondary'}>{selectedPoint.label}</Badge>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-600">Координаты:</div>
                      <div className="font-medium">({selectedPoint.x.toFixed(1)}%, {selectedPoint.y.toFixed(1)}%)</div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-2 text-sm items-center">
                      <Label htmlFor="manual-water">А.о. уровня, м</Label>
                      <input
                        id="manual-water"
                        type="number"
                        step="0.1"
                        value={manualWaterLevel}
                        onChange={(e) => setManualWaterLevel(e.target.value)}
                        className="h-8 rounded border px-2 text-sm"
                        placeholder="например, 84.0"
                      />
                      <Label htmlFor="manual-mouth">А.о. устья, м</Label>
                      <input
                        id="manual-mouth"
                        type="number"
                        step="0.1"
                        value={manualAbsMouth}
                        onChange={(e) => setManualAbsMouth(e.target.value)}
                        className="h-8 rounded border px-2 text-sm"
                        placeholder="например, 88.3"
                      />
                      <Label htmlFor="manual-depth">Глубина, м</Label>
                      <input
                        id="manual-depth"
                        type="number"
                        step="0.1"
                        value={manualDepth}
                        onChange={(e) => setManualDepth(e.target.value)}
                        className="h-8 rounded border px-2 text-sm"
                        placeholder="например, 4.3"
                      />
                    </div>
                    <Button size="sm" className="w-full" onClick={applySelectedPointLevels}>Сохранить данные точки</Button>
                    {manualEditStatus && <p className="text-xs text-slate-600">{manualEditStatus}</p>}
                  </div>
                ) : <p className="text-slate-500 text-sm">Выберите точку на карте</p>}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-slate-700" /> Импорт списка высот
                </CardTitle>
                <CardDescription>Поддержка CSV/TXT/JSON для пакетного обновления точек</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={bulkHeightsText}
                  onChange={(e) => setBulkHeightsText(e.target.value)}
                  rows={7}
                  className="w-full rounded border p-2 text-xs font-mono"
                  placeholder={`type,id,waterLevel,absMouth,depth\nborehole,1,84.0,88.3,4.3\nshaft,2,86.4,92.4,6.0\n\nили:\nid,waterLevel\n1,84.0\n2,86.0`}
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => applyHeightRows(bulkHeightsText)}>Применить список</Button>
                  <Button variant="outline" size="sm" onClick={() => heightsInputRef.current?.click()}>Импорт файла</Button>
                </div>
                <input
                  ref={heightsInputRef}
                  type="file"
                  accept=".csv,.txt,.json,text/plain,application/json"
                  className="hidden"
                  onChange={handleHeightsFileImport}
                />
                <p className="text-xs text-slate-500">
                  Если `id` одинаковый у скважины и шурфа, добавьте `type` (`borehole` или `shaft`) для точного попадания.
                </p>
                {bulkImportStatus && <p className="text-xs text-slate-700">{bulkImportStatus}</p>}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Точки ({points.length})</CardTitle>
                <CardDescription>С данными: {pointsWithData.length}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {points.length === 0 ? <p className="text-slate-500 text-sm">Нет точек</p> : points.map(point => (
                    <div key={`${point.type}-${point.id}`}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-slate-50 ${selectedPoint && isSamePoint(selectedPoint, point) ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedPoint(point)}>
                      <div className="flex items-center gap-2">
                        <span className={point.type === 'borehole' ? 'text-blue-600' : point.type === 'shaft' ? 'text-green-600' : 'text-yellow-600'}>
                          {point.type === 'borehole' ? '○' : point.type === 'shaft' ? '□' : '●'}
                        </span>
                        <span className="text-sm font-medium">{point.label}</span>
                      </div>
                      {point.waterLevel !== undefined && <span className="text-xs text-slate-500">{point.waterLevel.toFixed(1)} м</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-3"><CardTitle className="text-lg">Данные (Вар. 10)</CardTitle></CardHeader>
              <CardContent className="text-xs space-y-2">
                <div>
                  <div className="font-semibold text-blue-600 mb-1">Скважины:</div>
                  <div className="text-slate-600">1(84.0), 2(86.0), 3(85.5), 4(80.8), 8(85.9), 9(86.0), 10(81.5), 16(85.0), 17(81.0)</div>
                </div>
                <div>
                  <div className="font-semibold text-green-600 mb-1">Шурфы:</div>
                  <div className="text-slate-600">1(83.5), 2(86.4), 3(82.0), 4(86.0)</div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="pb-3"><CardTitle className="text-lg">Точки А и Б</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full" onClick={() => addCustomPoint('pointA')}>+ Добавить точку А</Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => addCustomPoint('pointB')}>+ Добавить точку Б</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
