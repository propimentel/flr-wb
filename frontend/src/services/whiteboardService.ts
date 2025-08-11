import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  DocumentData,
  QuerySnapshot,
  Unsubscribe,
  getDocs,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { getFirebaseFirestore } from '../shared/firebase';
import { StrokeChunk } from '../types/whiteboard';

export class WhiteboardService {
  private firestore = getFirebaseFirestore();

  /**
   * Add a stroke chunk to Firestore
   */
  async addStrokeChunk(strokeChunk: Omit<StrokeChunk, 'id'>): Promise<void> {
    try {
      const strokesRef = collection(this.firestore, `boards/${strokeChunk.boardId}/strokes`);
      await addDoc(strokesRef, strokeChunk);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Subscribe to stroke changes for a board
   */
  subscribeToStrokes(
    boardId: string, 
    onStrokesUpdate: (strokes: StrokeChunk[]) => void
  ): Unsubscribe {
    const strokesRef = collection(this.firestore, `boards/${boardId}/strokes`);
    const q = query(strokesRef, orderBy('timestamp', 'asc'));

    return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const strokes: StrokeChunk[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        strokes.push({
          id: doc.id,
          boardId: data.boardId,
          uid: data.uid,
          timestamp: data.timestamp,
          points: data.points,
          color: data.color,
          size: data.size,
          chunkIndex: data.chunkIndex,
          strokeComplete: data.strokeComplete
        });
      });

      onStrokesUpdate(strokes);
    });
  }

  /**
   * Clear all strokes for a board
   */
  async clearAllStrokes(boardId: string): Promise<void> {
    try {
      const strokesRef = collection(this.firestore, `boards/${boardId}/strokes`);
      const snapshot = await getDocs(strokesRef);
      
      const deletePromises = snapshot.docs.map(document => 
        deleteDoc(doc(this.firestore, `boards/${boardId}/strokes`, document.id))
      );
      
      await Promise.all(deletePromises);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate a unique stroke ID
   */
  generateStrokeId(): string {
    return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
