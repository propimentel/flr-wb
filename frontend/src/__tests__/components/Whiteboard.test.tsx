import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Whiteboard } from '../../components/Whiteboard'

// Mock drawing utilities
jest.mock('../../utils/drawingUtils', () => ({
  getPointerPosition: jest.fn(() => ({ x: 100, y: 100 })),
  drawSmoothLine: jest.fn(),
  optimizePoints: jest.fn(points => points),
  resizeCanvas: jest.fn(),
  clearCanvas: jest.fn(),
}))

// Mock whiteboard service
const mockWhiteboardService = {
  generateStrokeId: jest.fn(() => 'stroke-123'),
  addStrokeChunk: jest.fn(() => Promise.resolve()),
  subscribeToStrokes: jest.fn(() => jest.fn()), // Returns unsubscribe function
}

jest.mock('../../services/whiteboardService', () => ({
  WhiteboardService: jest.fn(() => mockWhiteboardService)
}))

// Mock firebase utils
jest.mock('../../shared/firebase', () => ({
  getStoredUid: () => 'test-uid-123'
}))

describe('Whiteboard Component', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'round',
      lineJoin: 'round',
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      stroke: jest.fn(),
      clearRect: jest.fn(),
      drawImage: jest.fn(),
    }))
  })

  it('renders canvas and drawing controls', () => {
    render(<Whiteboard boardId="test-board" />)
    
    expect(screen.getByRole('slider')).toBeInTheDocument() // Pen size slider
    expect(screen.getByDisplayValue('#000000')).toBeInTheDocument() // Color picker
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
    
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('starts drawing on mouse down', async () => {
    render(<Whiteboard boardId="test-board" />)
    
    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()

    fireEvent.mouseDown(canvas!, { clientX: 100, clientY: 100 })
    
    // Should call getPointerPosition
    const { getPointerPosition } = require('../../utils/drawingUtils')
    expect(getPointerPosition).toHaveBeenCalled()
  })

  it('continues drawing on mouse move', async () => {
    render(<Whiteboard boardId="test-board" />)
    
    const canvas = document.querySelector('canvas')!
    
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(canvas, { clientX: 110, clientY: 110 })
    
    const { getPointerPosition } = require('../../utils/drawingUtils')
    expect(getPointerPosition).toHaveBeenCalledTimes(2)
  })

  it('ends drawing on mouse up', async () => {
    render(<Whiteboard boardId="test-board" />)
    
    const canvas = document.querySelector('canvas')!
    
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(canvas, { clientX: 110, clientY: 110 })
    fireEvent.mouseUp(canvas)
    
    // Should call addStrokeChunk service method
    await waitFor(() => {
      expect(mockWhiteboardService.addStrokeChunk).toHaveBeenCalled()
    })
  })

  it('handles touch events', () => {
    render(<Whiteboard boardId="test-board" />)
    
    const canvas = document.querySelector('canvas')!
    
    fireEvent.touchStart(canvas, {
      touches: [{ clientX: 100, clientY: 100 }]
    })
    
    const { getPointerPosition } = require('../../utils/drawingUtils')
    expect(getPointerPosition).toHaveBeenCalled()
  })

  it('updates pen size when slider changes', async () => {
    render(<Whiteboard boardId="test-board" />)
    
    const slider = screen.getByRole('slider')
    
    fireEvent.change(slider, { target: { value: '8' } })
    
    expect(slider).toHaveValue('8')
  })

  it('updates color when color picker changes', async () => {
    render(<Whiteboard boardId="test-board" />)
    
    const colorPicker = screen.getByDisplayValue('#000000')
    
    fireEvent.change(colorPicker, { target: { value: '#ff0000' } })
    
    expect(colorPicker).toHaveValue('#ff0000')
  })

  it('clears canvas when clear button is clicked', async () => {
    render(<Whiteboard boardId="test-board" />)
    
    const clearButton = screen.getByRole('button', { name: /clear/i })
    
    await user.click(clearButton)
    
    const { clearCanvas } = require('../../utils/drawingUtils')
    expect(clearCanvas).toHaveBeenCalled()
  })

  it('subscribes to stroke updates on mount', () => {
    render(<Whiteboard boardId="test-board" />)
    
    expect(mockWhiteboardService.subscribeToStrokes).toHaveBeenCalledWith(
      'test-board',
      expect.any(Function)
    )
  })

  it('prevents default on touch events to avoid scrolling', () => {
    render(<Whiteboard boardId="test-board" />)
    
    const canvas = document.querySelector('canvas')!
    const touchEvent = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [{ clientX: 100, clientY: 100 } as Touch]
    })
    
    const preventDefaultSpy = jest.spyOn(touchEvent, 'preventDefault')
    fireEvent(canvas, touchEvent)
    
    expect(preventDefaultSpy).toHaveBeenCalled()
  })
})
