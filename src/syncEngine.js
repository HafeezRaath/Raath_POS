// src/syncEngine.js
import { db } from './firebase';
import { 
  collection, doc, setDoc, getDoc, getDocs, 
  deleteDoc, onSnapshot, writeBatch, serverTimestamp 
} from 'firebase/firestore';

class SyncEngine {
  constructor(shopId = 'default_shop') {
    this.shopId = shopId;
    this.pendingQueue = [];
    this.isOnline = navigator.onLine;
    this.listeners = [];
    
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Online — flushing sync queue');
      this.flushQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Offline — changes queued');
    });
    
    this.loadQueueFromStorage();
  }

  // ==================== LOCAL QUEUE ====================
  
  loadQueueFromStorage() {
    try {
      const saved = localStorage.getItem('raath_sync_queue');
      if (saved) this.pendingQueue = JSON.parse(saved);
    } catch (e) { this.pendingQueue = []; }
  }

  saveQueue() {
    localStorage.setItem('raath_sync_queue', JSON.stringify(this.pendingQueue));
  }

  addToQueue(operation, collectionName, data, docId = null) {
    this.pendingQueue.push({
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      operation,
      collectionName,
      data,
      docId,
      timestamp: new Date().toISOString()
    });
    this.saveQueue();
  }

  // ==================== FIRESTORE HELPERS ====================

  getRef(collectionName, docId) {
    return doc(db, 'shops', this.shopId, collectionName, docId);
  }

  getCollectionRef(collectionName) {
    return collection(db, 'shops', this.shopId, collectionName);
  }

  // ==================== CRUD OPERATIONS ====================

  async save(collectionName, data, docId = null) {
    const id = docId || data.id || `${collectionName}_${Date.now()}`;
    const cleanData = {
      ...data,
      id,
      updatedAt: serverTimestamp(),
      createdAt: data.createdAt || serverTimestamp()
    };

    if (this.isOnline) {
      try {
        await setDoc(this.getRef(collectionName, id), cleanData);
        console.log(`☁️ Synced: ${collectionName}/${id}`);
      } catch (err) {
        console.warn('Sync failed, queued:', err.message);
        this.addToQueue('save', collectionName, cleanData, id);
      }
    } else {
      this.addToQueue('save', collectionName, cleanData, id);
    }
    return id;
  }

  async remove(collectionName, docId) {
    if (this.isOnline) {
      try {
        await deleteDoc(this.getRef(collectionName, docId));
      } catch (err) {
        this.addToQueue('delete', collectionName, null, docId);
      }
    } else {
      this.addToQueue('delete', collectionName, null, docId);
    }
  }

  async get(collectionName, docId) {
    if (!this.isOnline) return null;
    const snap = await getDoc(this.getRef(collectionName, docId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async getAll(collectionName) {
    if (!this.isOnline) return [];
    const snap = await getDocs(this.getCollectionRef(collectionName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ==================== REAL-TIME LISTENERS ====================

  listen(collectionName, callback) {
    const unsubscribe = onSnapshot(
      this.getCollectionRef(collectionName),
      (snapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(items);
      },
      (err) => console.error('Listener error:', err)
    );
    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  // ==================== QUEUE FLUSH ====================

  async flushQueue() {
    if (!this.isOnline || this.pendingQueue.length === 0) return;
    
    const batch = writeBatch(db);
    const toRemove = [];

    for (const item of this.pendingQueue) {
      try {
        if (item.operation === 'save') {
          batch.set(this.getRef(item.collectionName, item.docId), {
            ...item.data,
            updatedAt: serverTimestamp()
          });
        } else if (item.operation === 'delete') {
          batch.delete(this.getRef(item.collectionName, item.docId));
        }
        toRemove.push(item.id);
      } catch (e) {
        console.error('Batch item failed:', e);
      }
    }

    try {
      await batch.commit();
      this.pendingQueue = this.pendingQueue.filter(q => !toRemove.includes(q.id));
      this.saveQueue();
      console.log(`✅ Flushed ${toRemove.length} items to cloud`);
    } catch (e) {
      console.error('Flush failed:', e);
    }
  }

  // ==================== CLEANUP ====================

  cleanup() {
    this.listeners.forEach(unsub => unsub());
    this.listeners = [];
  }
}

export const syncEngine = new SyncEngine();
export default SyncEngine;