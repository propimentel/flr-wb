export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  thickness: number;
  timestamp: number;
  userId?: string;
}

export interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
  type: 'text' | 'system';
}

export interface UploadMeta {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  userId?: string;
  boardId?: string;
}

export interface Board {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  isPublic: boolean;
  collaborators?: string[];
  strokeCount?: number;
  messageCount?: number;
}

export interface User {
  id: string;
  displayName?: string;
  email?: string;
  createdAt: number;
  lastActiveAt: number;
  isAnonymous: boolean;
}

export interface CollaborationState {
  boardId: string;
  activeUsers: Array<{
    id: string;
    displayName?: string;
    cursor?: Point;
    lastSeen: number;
  }>;
  currentStroke?: Partial<Stroke>;
}
