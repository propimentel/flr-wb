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

  // Ensure offscreen canvas matches the visible canvas size exactly
  const syncOffscreenCanvasSize = (visible: HTMLCanvasElement, offscreen: HTMLCanvasElement) => {
    if (offscreen.width !== visible.width || offscreen.height !== visible.height) {
      offscreen.width = visible.width;
      offscreen.height = visible.height;
      offscreen.style.width = visible.style.width;
      offscreen.style.height = visible.style.height;
      const ratio = window.devicePixelRatio || 1;
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        // Reset transform before scaling to avoid compounding
        offCtx.setTransform(1, 0, 0, 1, 0, 0);
        offCtx.scale(ratio, ratio);
      }
    }
  };

  // Render all strokes to the canvas
  const renderAllStrokes = useCallback(() => {
    if (!canvasRef.current || !offscreenCanvasRef.current) return;
    
    // Ensure both canvases are the same size before rendering
    syncOffscreenCanvasSize(canvasRef.current, offscreenCanvasRef.current);
    
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
        // Small delay to ensure DOM has updated
        setTimeout(() => {
          if (canvasRef.current) {
            // Resize the visible canvas using DOM dimensions
            resizeCanvas(canvasRef.current);
            // Force offscreen canvas to match the visible one exactly
            if (offscreenCanvasRef.current) {
              syncOffscreenCanvasSize(canvasRef.current, offscreenCanvasRef.current);
            }
            // Redraw all strokes after resize
            renderAllStrokes();
          }
        }, 10);
      }
    };

    // Setup ResizeObserver for the canvas container
    let resizeObserver: ResizeObserver | null = null;
    if (canvasRef.current) {
      const canvasContainer = canvasRef.current.parentElement;
      if (canvasContainer) {
        resizeObserver = new ResizeObserver(() => {
          handleResize();
        });
        resizeObserver.observe(canvasContainer);
      }
    }

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial sizing

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [renderAllStrokes]);

  // Render current stroke being drawn
  const renderCurrentStroke = useCallback(() => {
    if (!canvasRef.current || !drawingState.isDrawing || drawingState.currentStroke.length < 2) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // First, copy the off-screen canvas (with all completed strokes)
    if (offscreenCanvasRef.current) {
      // Ensure offscreen matches visible before copying
      syncOffscreenCanvasSize(canvasRef.current, offscreenCanvasRef.current);
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
    <div style={{ 
      width: '100%', 
      height: '100%',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Canvas - takes all space except toolbar */}
      <div style={{
        position: 'relative',
        flex: 1,
        width: '100%',
        backgroundColor: 'white',
        overflow: 'hidden'
      }}>
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
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: 'crosshair',
            touchAction: 'none',
            display: 'block'
          }}
        />
      </div>
      
      {/* Toolbar - fixed height at bottom */}
      <div style={{
        height: '80px',
        flexShrink: 0,
        padding: '16px',
        background: 'linear-gradient(to right, #f8fafc, #f1f5f9)',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -1px 3px 0 rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Pen Size Control */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #f3f4f6',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
          }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              whiteSpace: 'nowrap'
            }}>
              Pen Size:
            </label>
            <input
              type="range"
              min="1"
              max="20"
              value={settings.penSize}
              onChange={(e) => setSettings({ ...settings, penSize: Number(e.target.value) })}
              style={{ width: '80px', height: '4px' }}
            />
            <span style={{
              fontSize: '12px',
              color: '#6b7280',
              fontFamily: 'monospace',
              backgroundColor: '#f9fafb',
              padding: '2px 6px',
              borderRadius: '4px',
              minWidth: '28px',
              textAlign: 'center'
            }}>
              {settings.penSize}px
            </span>
          </div>
          
          {/* Divider */}
          <div style={{ width: '1px', height: '24px', backgroundColor: '#d1d5db' }}></div>
          
          {/* Color Picker */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #f3f4f6',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
          }}>
            <label style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              Color:
            </label>
            <input
              type="color"
              value={settings.color}
              onChange={(e) => setSettings({ ...settings, color: e.target.value })}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: '2px solid #d1d5db',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
        
        {/* Clear Button */}
        <button
          onClick={handleClearCanvas}
          style={{
            padding: '8px 12px',
            backgroundColor: '#ef4444',
            color: 'white',
            fontWeight: '500',
            fontSize: '14px',
            borderRadius: '6px',
            border: 'none',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          onMouseOver={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#dc2626';
          }}
          onMouseOut={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#ef4444';
          }}
        >
          <span>🗑</span> Clear
        </button>
      </div>
    </div>
  );
};

