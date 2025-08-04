import { 
  getDistance, 
  getPointerPosition, 
  drawSmoothLine, 
  optimizePoints, 
  smoothPoints,
  resizeCanvas,
  clearCanvas 
} from '../../utils/drawingUtils'

describe('Drawing Utils', () => {
  describe('getDistance', () => {
    it('calculates distance between two points', () => {
      const point1 = { x: 0, y: 0 }
      const point2 = { x: 3, y: 4 }
      
      expect(getDistance(point1, point2)).toBe(5)
    })

    it('returns 0 for same point', () => {
      const point = { x: 5, y: 5 }
      
      expect(getDistance(point, point)).toBe(0)
    })
  })

  describe('getPointerPosition', () => {
    it('converts mouse event to canvas coordinates', () => {
      const mockEvent = {
        clientX: 100,
        clientY: 200,
      } as MouseEvent

      const mockCanvas = {
        getBoundingClientRect: () => ({
          left: 50,
          top: 100,
          width: 400,
          height: 300,
        }),
        width: 800,
        height: 600,
      } as HTMLCanvasElement

      const coords = getPointerPosition(mockEvent, mockCanvas)
      
      expect(coords).toEqual({ x: 100, y: 200 })
    })

    it('handles touch events', () => {
      const mockEvent = {
        touches: [{
          clientX: 150,
          clientY: 250,
        }]
      } as TouchEvent

      const mockCanvas = {
        getBoundingClientRect: () => ({
          left: 50,
          top: 100,
          width: 400,
          height: 300,
        }),
        width: 800,
        height: 600,
      } as HTMLCanvasElement

      const coords = getPointerPosition(mockEvent, mockCanvas)
      
      expect(coords).toEqual({ x: 200, y: 300 })
    })
  })

  describe('optimizePoints', () => {
    it('removes points that are too close together', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 5, y: 5 },
        { x: 6, y: 6 },
        { x: 10, y: 10 }
      ]

      const optimized = optimizePoints(points, 3)
      
      expect(optimized.length).toBeLessThan(points.length)
      expect(optimized[0]).toEqual({ x: 0, y: 0 })
      expect(optimized[optimized.length - 1]).toEqual({ x: 10, y: 10 })
    })

    it('keeps all points when they are far apart', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 20 }
      ]

      const optimized = optimizePoints(points, 2)
      
      expect(optimized).toEqual(points)
    })
  })

  describe('smoothPoints', () => {
    it('smooths a set of points', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 5, y: 15 },
        { x: 15, y: 5 },
        { x: 20, y: 20 }
      ]

      const smoothed = smoothPoints(points)
      
      expect(smoothed.length).toBe(points.length)
      expect(smoothed[0]).toEqual(points[0]) // First point unchanged
      expect(smoothed[smoothed.length - 1]).toEqual(points[points.length - 1]) // Last point unchanged
    })
  })

  describe('clearCanvas', () => {
    it('clears the canvas context', () => {
      const mockContext = {
        clearRect: jest.fn()
      }
      
      const mockCanvas = {
        getContext: jest.fn(() => mockContext),
        width: 800,
        height: 600
      } as unknown as HTMLCanvasElement

      clearCanvas(mockCanvas)
      
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    })
  })
})
