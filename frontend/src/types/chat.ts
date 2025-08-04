export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: number;
  uploadedBy: string;
}

export interface ChatMessage {
  id: string;
  boardId: string;
  uid: string;
  timestamp: number;
  content: string;
  type: 'text' | 'file' | 'system';
  fileMetadata?: FileMetadata;
  userName?: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}
