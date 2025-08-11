import React, { useRef, useState, useEffect, useCallback } from 'react';
import { WhiteboardService } from '../services/whiteboardService';
import {
  getPointerPosition,
  drawSmoothLine,
  optimizePoints,
  resizeCanvas,
  clearCanvas,
} from '../utils/drawingUtils';
import { StrokeChunk, WhiteboardSettings, DrawingState } from '../types/whiteboard';
import { getStoredUid } from '../shared/firebase';

interface WhiteboardProps {
  boardId: string;
}

export const Whiteboard: React.FC<WhiteboardProps> = ({ boardId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const serviceRef = useRef(new WhiteboardService());
  const uid = getStoredUid() || 'anonymous';
  const animationFrameRef = useRef<number | null>(null);

  const [settings, setSettings] = useState<WhiteboardSettings>({ penSize: 5, color: '#000000' });
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    currentStroke: [],
    currentStrokeId: null,
    chunkIndex: 0,
  });
  const [allStrokes, setAllStrokes] = useState<StrokeChunk[]>([]);

  // Initialize off-screen canvas for smooth rendering
  useEffect(() => {
    if (canvasRef.current && !offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  // Render all strokes to the canvas
  const renderAllStrokes = useCallback(() => {
    if (!canvasRef.current || !offscreenCanvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const offscreenCtx = offscreenCanvasRef.current.getContext('2d');
    if (!ctx || !offscreenCtx) return;

    // Check if canvases have valid dimensions
    if (canvasRef.current.width === 0 || canvasRef.current.height === 0 ||
        offscreenCanvasRef.current.width === 0 || offscreenCanvasRef.current.height === 0) {
      return;
    }

    // Clear both canvases
    clearCanvas(canvasRef.current);
    clearCanvas(offscreenCanvasRef.current);

    // Draw all strokes to off-screen canvas first
    allStrokes.forEach((stroke) => {
      drawSmoothLine(offscreenCtx, stroke.points, stroke.color, stroke.size);
    });

    // Copy from off-screen canvas to main canvas
    ctx.drawImage(offscreenCanvasRef.current, 0, 0);
  }, [allStrokes]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        resizeCanvas(canvasRef.current);
        if (offscreenCanvasRef.current) {
          resizeCanvas(offscreenCanvasRef.current);
        }
        // Redraw all strokes after resize
        renderAllStrokes();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial sizing

    return () => window.removeEventListener('resize', handleResize);
  }, [renderAllStrokes]);

  // Render current stroke being drawn
  const renderCurrentStroke = useCallback(() => {
    if (!canvasRef.current || !drawingState.isDrawing || drawingState.currentStroke.length < 2) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // First, copy the off-screen canvas (with all completed strokes)
    if (offscreenCanvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(offscreenCanvasRef.current, 0, 0);
    }

    // Then draw the current stroke on top
    drawSmoothLine(ctx, drawingState.currentStroke, settings.color, settings.penSize);
  }, [drawingState, settings]);

  // Animation loop for smooth rendering
  useEffect(() => {
    if (drawingState.isDrawing) {
      const animate = () => {
        renderCurrentStroke();
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawingState.isDrawing, renderCurrentStroke]);

  const startDrawing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return;
    event.preventDefault();
    const pointerPosition = getPointerPosition(event.nativeEvent, canvasRef.current);

    setDrawingState((prev) => ({
      ...prev,
      isDrawing: true,
      currentStroke: [pointerPosition],
      currentStrokeId: serviceRef.current.generateStrokeId(),
      chunkIndex: 0,
    }));
  }, []);

  const draw = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (!canvasRef.current || !drawingState.isDrawing) return;
      const pointerPosition = getPointerPosition(event.nativeEvent, canvasRef.current);

      setDrawingState((prev) => {
        // Add point to current stroke
        const newStroke = [...prev.currentStroke, pointerPosition];

        return {
          ...prev,
          currentStroke: optimizePoints(newStroke),
        };
      });
    },
    [drawingState.isDrawing]
  );

  const endDrawing = useCallback(() => {
    if (!canvasRef.current || drawingState.currentStroke.length === 0) return;

    const chunk: StrokeChunk = {
      id: '',
      boardId,
      uid,
      timestamp: Date.now(),
      points: drawingState.currentStroke,
      color: settings.color,
      size: settings.penSize,
      chunkIndex: drawingState.chunkIndex,
      strokeComplete: true,
    };

    // Save the stroke to Firestore
    serviceRef.current.addStrokeChunk(chunk);

    // Reset drawing state
    setDrawingState((prev) => ({
      ...prev,
      isDrawing: false,
      currentStroke: [],
      currentStrokeId: null,
      chunkIndex: 0,
    }));
  }, [drawingState, settings, boardId, uid]);

  const handleStrokeUpdate = useCallback((strokes: StrokeChunk[]) => {
    setAllStrokes(strokes);
  }, []);

  const handleClearCanvas = useCallback(async () => {
    try {
      // Create a fresh service instance to ensure we have the latest methods
      const service = new WhiteboardService();
      
      // Clear all strokes from the database
      await service.clearAllStrokes(boardId);
      
      // Clear local state
      setAllStrokes([]);
      
      // Clear the canvas
      if (canvasRef.current) {
        clearCanvas(canvasRef.current);
      }
      if (offscreenCanvasRef.current) {
        clearCanvas(offscreenCanvasRef.current);
      }
    } catch (error) {
    }
  }, [boardId]);

  // Re-render canvas whenever allStrokes changes (real-time updates)
  useEffect(() => {
    renderAllStrokes();
  }, [allStrokes, renderAllStrokes]);

  useEffect(() => {
    const unsubscribe = serviceRef.current.subscribeToStrokes(boardId, handleStrokeUpdate);
    return unsubscribe;
  }, [boardId, handleStrokeUpdate]);

  return (
    <div className="flex flex-col h-full">
      {/* Canvas Container */}
      <div className="flex-1 relative bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          onTouchCancel={endDrawing}
          className="w-full h-full cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 p-4 bg-gradient-to-r from-slate-50 to-gray-50 border-t border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Pen Size Control */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-md border border-gray-100 shadow-sm">
            <label className="text-xs font-medium text-gray-700 min-w-max">
              Pen Size:
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={settings.penSize}
              onChange={(e) =>
                setSettings({ ...settings, penSize: Number(e.target.value) })
              }
              className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <span className="text-xs text-gray-600 min-w-max font-mono bg-gray-50 px-1.5 py-0.5 rounded text-center" style={{ minWidth: '28px' }}>
              {settings.penSize}px
            </span>
          </div>
          
          {/* Divider */}
          <div className="w-px h-6 bg-gray-300"></div>
          
          {/* Color Picker */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-md border border-gray-100 shadow-sm">
            <label className="text-xs font-medium text-gray-700">
              Color:
            </label>
            <input
              type="color"
              value={settings.color}
              onChange={(e) => setSettings({ ...settings, color: e.target.value })}
              className="w-8 h-8 rounded-md border-2 border-gray-300 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
            />
          </div>
        </div>
        
        {/* Clear Button */}
        <button
          onClick={handleClearCanvas}
          className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white font-medium text-xs rounded-md shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 hover:scale-105"
        >
          <span className="text-white">🗑</span> Clear
        </button>
      </div>
    </div>
  );
};

