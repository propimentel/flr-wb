import { Point } from '../types/whiteboard';

/**
 * Get pointer coordinates relative to canvas, handling both mouse and touch events
 */
export const getPointerPosition = (
  event: MouseEvent | TouchEvent, 
  canvas: HTMLCanvasElement
): Point => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  let clientX: number;
  let clientY: number;

  if ('touches' in event) {
    // Touch event
    const touch = event.touches[0] || event.changedTouches[0];
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    // Mouse event
    clientX = event.clientX;
    clientY = event.clientY;
  }

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
};

/**
 * Draw a smooth line between points using quadratic curves
 */
export const drawSmoothLine = (
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  size: number
): void => {
  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();

  if (points.length === 2) {
    // For two points, draw a straight line
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    // For multiple points, use quadratic curves for smoothness
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
      const cp = {
        x: (points[i].x + points[i + 1].x) / 2,
        y: (points[i].y + points[i + 1].y) / 2
      };
      ctx.quadraticCurveTo(points[i].x, points[i].y, cp.x, cp.y);
    }

    // Draw the last segment
    const lastPoint = points[points.length - 1];
    const secondLastPoint = points[points.length - 2];
    ctx.quadraticCurveTo(secondLastPoint.x, secondLastPoint.y, lastPoint.x, lastPoint.y);
  }

  ctx.stroke();
};

/**
 * Smooth points using simple moving average
 */
export const smoothPoints = (points: Point[], windowSize: number = 3): Point[] => {
  if (points.length <= windowSize) return points;

  const smoothed: Point[] = [...points]; // Start with original points

  for (let i = windowSize; i < points.length - windowSize; i++) {
    let sumX = 0;
    let sumY = 0;
    
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      sumX += points[j].x;
      sumY += points[j].y;
    }
    
    smoothed[i] = {
      x: sumX / (windowSize * 2 + 1),
      y: sumY / (windowSize * 2 + 1)
    };
  }

  return smoothed;
};

/**
 * Calculate distance between two points
 */
export const getDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

/**
 * Reduce points by removing those too close together
 */
export const optimizePoints = (points: Point[], minDistance: number = 2): Point[] => {
  if (points.length <= 1) return points;

  const optimized: Point[] = [points[0]];
  
  for (let i = 1; i < points.length; i++) {
    if (getDistance(optimized[optimized.length - 1], points[i]) >= minDistance) {
      optimized.push(points[i]);
    }
  }

  // Always include the last point if it's not already included
  if (optimized[optimized.length - 1] !== points[points.length - 1]) {
    optimized.push(points[points.length - 1]);
  }

  return optimized;
};

/**
 * Resize canvas to match display size while maintaining drawing context
 */
export const resizeCanvas = (canvas: HTMLCanvasElement): void => {
  const devicePixelRatio = window.devicePixelRatio || 1;
  
  // Get parent container dimensions first
  const parentRect = canvas.parentElement?.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  
  // Prefer parent dimensions over canvas rect
  let width = parentRect?.width || canvasRect.width;
  let height = parentRect?.height || canvasRect.height;
  
  // If we still don't have valid dimensions, don't resize
  if (!width || !height || width < 50 || height < 50) {
    return;
  }
  
  // Round to avoid sub-pixel issues
  width = Math.floor(width);
  height = Math.floor(height);
  
  // Don't resize if canvas already has the correct dimensions
  const currentDisplayWidth = Math.round(canvas.width / devicePixelRatio);
  const currentDisplayHeight = Math.round(canvas.height / devicePixelRatio);
  
  if (Math.abs(currentDisplayWidth - width) < 2 && Math.abs(currentDisplayHeight - height) < 2) {
    return;
  }
  
  // Set the actual size in memory (scaled to account for high DPI displays)
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  
  // Set the display size using CSS
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  // Scale the drawing context to match the device pixel ratio
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(devicePixelRatio, devicePixelRatio);
  }
};

/**
 * Clear the entire canvas
 */
export const clearCanvas = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
};
