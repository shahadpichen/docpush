import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = '.docpush';
const DRAFTS_FILE = 'drafts.json';
const SESSIONS_FILE = 'sessions.json';

// Types
export interface Draft {
  id: string;
  docPath: string;
  branchName: string;
  title: string;
  authorId: string | null;
  authorEmail: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  updatedAt: number;
}

export interface DraftComment {
  id: string;
  draftId: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  content: string;
  createdAt: number;
}

interface DraftsData {
  drafts: Draft[];
  comments: DraftComment[];
}

interface SessionsData {
  sessions: Record<string, { userId: string; email: string; name?: string; expiresAt: number }>;
  magicLinks: Record<string, { email: string; expiresAt: number; used: boolean }>;
}

// Ensure data directory exists
async function ensureDataDir(): Promise<string> {
  const dataDir = path.join(process.cwd(), DATA_DIR);
  await fs.ensureDir(dataDir);
  return dataDir;
}

// Drafts storage
async function loadDraftsData(): Promise<DraftsData> {
  const dataDir = await ensureDataDir();
  const filePath = path.join(dataDir, DRAFTS_FILE);
  
  if (await fs.pathExists(filePath)) {
    return fs.readJson(filePath);
  }
  
  return { drafts: [], comments: [] };
}

async function saveDraftsData(data: DraftsData): Promise<void> {
  const dataDir = await ensureDataDir();
  const filePath = path.join(dataDir, DRAFTS_FILE);
  await fs.writeJson(filePath, data, { spaces: 2 });
}

// Sessions storage
async function loadSessionsData(): Promise<SessionsData> {
  const dataDir = await ensureDataDir();
  const filePath = path.join(dataDir, SESSIONS_FILE);
  
  if (await fs.pathExists(filePath)) {
    return fs.readJson(filePath);
  }
  
  return { sessions: {}, magicLinks: {} };
}

async function saveSessionsData(data: SessionsData): Promise<void> {
  const dataDir = await ensureDataDir();
  const filePath = path.join(dataDir, SESSIONS_FILE);
  await fs.writeJson(filePath, data, { spaces: 2 });
}

// Helper functions
export function generateId(): string {
  return randomUUID();
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

// Draft operations
export async function getDrafts(status?: string): Promise<Draft[]> {
  const data = await loadDraftsData();
  if (status) {
    return data.drafts.filter(d => d.status === status);
  }
  return data.drafts;
}

export async function getDraft(id: string): Promise<Draft | null> {
  const data = await loadDraftsData();
  return data.drafts.find(d => d.id === id) || null;
}

export async function createDraft(draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'>): Promise<Draft> {
  const data = await loadDraftsData();
  const newDraft: Draft = {
    ...draft,
    id: generateId(),
    createdAt: now(),
    updatedAt: now()
  };
  data.drafts.push(newDraft);
  await saveDraftsData(data);
  return newDraft;
}

export async function updateDraft(id: string, updates: Partial<Draft>): Promise<Draft | null> {
  const data = await loadDraftsData();
  const index = data.drafts.findIndex(d => d.id === id);
  if (index === -1) return null;
  
  data.drafts[index] = {
    ...data.drafts[index],
    ...updates,
    updatedAt: now()
  };
  await saveDraftsData(data);
  return data.drafts[index];
}

export async function deleteDraft(id: string): Promise<boolean> {
  const data = await loadDraftsData();
  const index = data.drafts.findIndex(d => d.id === id);
  if (index === -1) return false;
  
  data.drafts.splice(index, 1);
  // Also delete comments for this draft
  data.comments = data.comments.filter(c => c.draftId !== id);
  await saveDraftsData(data);
  return true;
}

// Comment operations
export async function getComments(draftId: string): Promise<DraftComment[]> {
  const data = await loadDraftsData();
  return data.comments.filter(c => c.draftId === draftId);
}

export async function addComment(comment: Omit<DraftComment, 'id' | 'createdAt'>): Promise<DraftComment> {
  const data = await loadDraftsData();
  const newComment: DraftComment = {
    ...comment,
    id: generateId(),
    createdAt: now()
  };
  data.comments.push(newComment);
  await saveDraftsData(data);
  return newComment;
}

// Session operations
export async function createSession(userId: string, email: string, name?: string): Promise<string> {
  const data = await loadSessionsData();
  const token = generateId();
  data.sessions[token] = {
    userId,
    email,
    name,
    expiresAt: now() + 86400 // 24 hours
  };
  await saveSessionsData(data);
  return token;
}

export async function getSession(token: string): Promise<{ userId: string; email: string; name?: string } | null> {
  const data = await loadSessionsData();
  const session = data.sessions[token];
  if (!session || session.expiresAt < now()) {
    return null;
  }
  return { userId: session.userId, email: session.email, name: session.name };
}

export async function deleteSession(token: string): Promise<void> {
  const data = await loadSessionsData();
  delete data.sessions[token];
  await saveSessionsData(data);
}

// Magic link operations
export async function createMagicLink(email: string): Promise<string> {
  const data = await loadSessionsData();
  const token = generateId();
  data.magicLinks[token] = {
    email,
    expiresAt: now() + 900, // 15 minutes
    used: false
  };
  await saveSessionsData(data);
  return token;
}

export async function verifyMagicLink(token: string): Promise<string | null> {
  const data = await loadSessionsData();
  const link = data.magicLinks[token];
  
  if (!link || link.used || link.expiresAt < now()) {
    return null;
  }
  
  // Mark as used
  data.magicLinks[token].used = true;
  await saveSessionsData(data);
  
  return link.email;
}

// Cleanup expired data
export async function cleanupExpired(): Promise<void> {
  const sessionsData = await loadSessionsData();
  const currentTime = now();
  
  // Clean expired sessions
  for (const token of Object.keys(sessionsData.sessions)) {
    if (sessionsData.sessions[token].expiresAt < currentTime) {
      delete sessionsData.sessions[token];
    }
  }
  
  // Clean expired magic links
  for (const token of Object.keys(sessionsData.magicLinks)) {
    if (sessionsData.magicLinks[token].expiresAt < currentTime) {
      delete sessionsData.magicLinks[token];
    }
  }
  
  await saveSessionsData(sessionsData);
}
