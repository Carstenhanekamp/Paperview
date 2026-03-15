import Dexie from 'dexie';

export const db = new Dexie('PaperviewDB');

db.version(1).stores({
  chats: 'id, paperId, updatedAt',
});

db.version(2).stores({
  chats: 'id, paperId, updatedAt',
  folderHandles: 'id',
});

db.version(3).stores({
  chats: 'id, paperId, updatedAt',
  folderHandles: 'id',
  annotations: 'id, paperId, pageNum, createdAt',
});

export async function loadAllChats() {
  return db.chats.orderBy('updatedAt').reverse().toArray();
}

export async function saveChat(thread) {
  return db.chats.put(thread);
}

export async function deleteChat(threadId) {
  return db.chats.delete(threadId);
}

export async function deleteChatsByPaperIds(paperIds) {
  return db.chats.where('paperId').anyOf(paperIds).delete();
}

export async function saveFolderHandle(handle) {
  return db.folderHandles.put({ id: handle.name, handle });
}

export async function loadFolderHandles() {
  return db.folderHandles.toArray();
}

export async function clearFolderHandles() {
  return db.folderHandles.clear();
}

export async function saveAnnotation(annotation) {
  return db.annotations.put(annotation);
}

export async function loadAnnotations(paperId) {
  return db.annotations.where('paperId').equals(paperId).toArray();
}

export async function deleteAnnotation(id) {
  return db.annotations.delete(id);
}

export async function deleteAnnotationsByPaperIds(paperIds) {
  return db.annotations.where('paperId').anyOf(paperIds).delete();
}

export async function loadAllAnnotations() {
  return db.annotations.toArray();
}
