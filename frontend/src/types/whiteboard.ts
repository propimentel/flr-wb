export interface Point {
  x: number;
  y: number;
}

export interface StrokeChunk {
  id: string;
  boardId: string;
  uid: string;
  timestamp: number;
  points: Point[];
  color: string;
  size: number;
  chunkIndex: number;
  strokeComplete: boolean;
}

export interface WhiteboardSettings {
  penSize: number;
  color: string;
}

export interface DrawingState {
  isDrawing: boolean;
  currentStroke: Point[];
  currentStrokeId: string | null;
  chunkIndex: number;
}
