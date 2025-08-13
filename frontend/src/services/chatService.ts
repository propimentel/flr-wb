import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  DocumentData,
  QuerySnapshot,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { getFirebaseFirestore, getFirebaseAuth } from '../shared/firebase';
import { ChatMessage, FileMetadata } from '../types/chat';

export class ChatService {
  private firestore = getFirebaseFirestore();

  /**
   * Add a text message to the chat
   */
  async addTextMessage(boardId: string, uid: string, content: string): Promise<void> {
    const messagesRef = collection(this.firestore, 'boards', boardId, 'messages');
    
    const message: Omit<ChatMessage, 'id'> = {
      boardId,
      uid,
      timestamp: Date.now(),
      content,
      type: 'text',
      userName: `User ${uid.substring(0, 8)}...`
    };

    await addDoc(messagesRef, message);
  }

  /**
   * Add a file message to the chat
   */
  async addFileMessage(
    boardId: string, 
    uid: string, 
    fileMetadata: FileMetadata,
    message?: string
  ): Promise<void> {
    const messagesRef = collection(this.firestore, 'boards', boardId, 'messages');
    
    const chatMessage: Omit<ChatMessage, 'id'> = {
      boardId,
      uid,
      timestamp: Date.now(),
      content: message || `Shared file: ${fileMetadata.name}`,
      type: 'file',
      fileMetadata,
      userName: `User ${uid.substring(0, 8)}...`
    };

    await addDoc(messagesRef, chatMessage);
  }

  /**
   * Subscribe to real-time messages for a board
   */
  subscribeToMessages(
    boardId: string,
    callback: (messages: ChatMessage[]) => void
  ): () => void {
    const messagesRef = collection(this.firestore, 'boards', boardId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const messages: ChatMessage[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          boardId: data.boardId,
          uid: data.uid,
          timestamp: data.timestamp,
          content: data.content,
          type: data.type,
          fileMetadata: data.fileMetadata,
          userName: data.userName
        });
      });

      callback(messages);
    });
  }

  /**
   * Clear all messages for a board
   */
  async clearAllMessages(boardId: string): Promise<void> {
    try {
      const messagesRef = collection(this.firestore, 'boards', boardId, 'messages');
      const snapshot = await getDocs(messagesRef);
      
      const deletePromises = snapshot.docs.map(document => 
        deleteDoc(doc(this.firestore, 'boards', boardId, 'messages', document.id))
      );
      
      await Promise.all(deletePromises);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload file to backend and get URL
   */
  async uploadFile(file: File, uid: string): Promise<FileMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uid', uid);

    // Get Firebase auth token for backend authentication
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    
    const token = user ? await user.getIdToken() : null;
    
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Call backend API
    const baseUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:4000' 
      : (process.env.NEXT_PUBLIC_BACKEND_URL || '');
    const response = await fetch(`${baseUrl}/api/upload/`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const result = await response.json();
    
    const fileMetadata: FileMetadata = {
      id: result.id,
      name: file.name,
      size: file.size,
      type: file.type,
      url: result.url,
      uploadedAt: Date.now(),
      uploadedBy: uid
    };

    return fileMetadata;
  }
}
