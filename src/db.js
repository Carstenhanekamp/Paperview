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

db.version(4).stores({
  chats: 'id, paperId, updatedAt',
  folderHandles: 'id',
  annotations: 'id, paperId, pageNum, createdAt',
  paperTextCache: 'paperId, updatedAt',
  ocrPages: 'id, paperId, pageNum, scale, updatedAt',
});

db.version(5).stores({
  chats: 'id, paperId, updatedAt',
  agentChats: 'id, rootFolderId, updatedAt',
  folderHandles: 'id',
  annotations: 'id, paperId, pageNum, createdAt',
  paperTextCache: 'paperId, updatedAt',
  ocrPages: 'id, paperId, pageNum, scale, updatedAt',
});

db.version(6).stores({
  chats: 'id, paperId, updatedAt',
  agentChats: 'id, rootFolderId, updatedAt',
  folderHandles: 'id',
  annotations: 'id, paperId, pageNum, createdAt',
  paperTextCache: 'paperId, updatedAt',
  ocrPages: 'id, paperId, pageNum, scale, updatedAt',
  uploadedPdfs: 'paperId, updatedAt',
});

function makeOcrPageId(paperId, pageNum, scale) {
  return `${paperId}:${pageNum}:${scale}`;
}

export async function loadAllChats() {
  return db.chats.orderBy('updatedAt').reverse().toArray();
}

export async function saveChat(thread) {
  return db.chats.put(thread);
}

export async function deleteChat(threadId) {
  return db.chats.delete(threadId);
}

export async function loadAllAgentChats() {
  return db.agentChats.orderBy('updatedAt').reverse().toArray();
}

export async function saveAgentChat(thread) {
  return db.agentChats.put(thread);
}

export async function deleteAgentChat(threadId) {
  return db.agentChats.delete(threadId);
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

export async function loadPaperTextCache(paperId) {
  return db.paperTextCache.get(paperId);
}

export async function savePaperTextCache(entry) {
  return db.paperTextCache.put(entry);
}

export async function deletePaperTextCache(paperId) {
  return db.paperTextCache.delete(paperId);
}

export async function loadOcrPage({ paperId, pageNum, scale }) {
  return db.ocrPages.get(makeOcrPageId(paperId, pageNum, scale));
}

export async function saveOcrPage(entry) {
  return db.ocrPages.put({
    ...entry,
    id: makeOcrPageId(entry.paperId, entry.pageNum, entry.scale),
  });
}

export async function loadUploadedPdf(paperId) {
  return db.uploadedPdfs.get(paperId);
}

export async function saveUploadedPdf(entry) {
  return db.uploadedPdfs.put(entry);
}

export async function deleteUploadedPdf(paperId) {
  return db.uploadedPdfs.delete(paperId);
}

export async function deletePaperCachesByPaperIds(paperIds) {
  if (!paperIds?.length) return;
  await Promise.all([
    db.paperTextCache.where('paperId').anyOf(paperIds).delete(),
    db.ocrPages.where('paperId').anyOf(paperIds).delete(),
    db.uploadedPdfs.where('paperId').anyOf(paperIds).delete(),
  ]);
}
