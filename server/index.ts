import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import jwt, { type JwtPayload } from 'jsonwebtoken';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'combat-tracker.db');
const TOKEN_COOKIE = 'combat_tracker_token';
const TOKEN_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days
const TOKEN_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

type DbUser = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

type PublicUser = {
  id: string;
  email: string;
};

const ensureSchema = () => {
  db.exec(
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  );

  const encounterColumns = db.prepare(`PRAGMA table_info(encounters)`).all() as Array<{ name: string }>;
  const hasUserIdColumn = encounterColumns.some((column) => column.name === 'user_id');
  if (!hasUserIdColumn) {
    db.exec('DROP TABLE IF EXISTS encounters');
  }

  db.exec(
    `CREATE TABLE IF NOT EXISTS encounters (
      user_id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`
  );
};

ensureSchema();

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

const toPublicUser = (user: Pick<DbUser, 'id' | 'email'>): PublicUser => ({ id: user.id, email: user.email });

const selectUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const selectUserById = db.prepare('SELECT id, email FROM users WHERE id = ?');
const insertUser = db.prepare(
  `INSERT INTO users (id, email, password_hash, created_at)
   VALUES (@id, @email, @passwordHash, @createdAt)`
);

const selectEncounterByUser = db.prepare('SELECT state FROM encounters WHERE user_id = ?');
const upsertEncounter = db.prepare(
  `INSERT INTO encounters (user_id, state, updated_at)
   VALUES (@userId, @state, @updatedAt)
   ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`
);
const deleteEncounter = db.prepare('DELETE FROM encounters WHERE user_id = ?');

const createSessionToken = (userId: string) =>
  jwt.sign({ sub: userId }, TOKEN_SECRET, {
    expiresIn: '7d'
  });

const setSessionCookie = (res: Response, userId: string) => {
  const token = createSessionToken(userId);
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_MAX_AGE
  });
};

const clearSessionCookie = (res: Response) => {
  res.clearCookie(TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
};

interface AuthenticatedRequest extends Request {
  userId: string;
}

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[TOKEN_COOKIE];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, TOKEN_SECRET) as JwtPayload;
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Invalid session payload');
    }
    (req as AuthenticatedRequest).userId = payload.sub;
    next();
  } catch (error) {
    console.warn('Invalid session token', error);
    clearSessionCookie(res);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

app.get('/api/session', (req, res) => {
  const token = req.cookies?.[TOKEN_COOKIE];
  if (!token) {
    res.status(204).end();
    return;
  }

  try {
    const payload = jwt.verify(token, TOKEN_SECRET) as JwtPayload;
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Invalid token payload');
    }
    const user = selectUserById.get(payload.sub) as Pick<DbUser, 'id' | 'email'> | undefined;
    if (!user) {
      clearSessionCookie(res);
      res.status(204).end();
      return;
    }
    res.json(toPublicUser(user));
  } catch (error) {
    console.warn('Failed to verify session', error);
    clearSessionCookie(res);
    res.status(204).end();
  }
});

app.post('/api/signup', (req, res) => {
  const emailInput = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
    res.status(400).json({ error: 'A valid email is required.' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const email = emailInput.toLowerCase();

  const existing = selectUserByEmail.get(email) as DbUser | undefined;
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const userId = nanoid(21);

  try {
    insertUser.run({ id: userId, email, passwordHash, createdAt: new Date().toISOString() });
  } catch (error) {
    console.error('Failed to create user', error);
    res.status(500).json({ error: 'Failed to create user.' });
    return;
  }

  setSessionCookie(res, userId);
  res.status(201).json({ id: userId, email });
});

app.post('/api/login', (req, res) => {
  const emailInput = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!emailInput || password.length === 0) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const email = emailInput.toLowerCase();
  const user = selectUserByEmail.get(email) as DbUser | undefined;
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  setSessionCookie(res, user.id);
  res.json({ id: user.id, email: user.email });
});

app.post('/api/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

app.get('/api/encounter', requireAuth, (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  try {
    const row = selectEncounterByUser.get(userId) as { state: string } | undefined;
    if (!row) {
      res.status(204).end();
      return;
    }

    try {
      const payload = JSON.parse(row.state);
      res.json(payload);
    } catch (parseError) {
      console.error('Stored encounter could not be parsed. Clearing row.', parseError);
      deleteEncounter.run(userId);
      res.status(204).end();
    }
  } catch (error) {
    console.error('Failed to load encounter', error);
    res.status(500).json({ error: 'Failed to load encounter.' });
  }
});

app.put('/api/encounter', requireAuth, (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const state = req.body;
  if (!state || typeof state !== 'object') {
    res.status(400).json({ error: 'Encounter payload is required.' });
    return;
  }

  try {
    const serialized = JSON.stringify(state);
    upsertEncounter.run({ userId, state: serialized, updatedAt: new Date().toISOString() });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to save encounter', error);
    res.status(500).json({ error: 'Failed to save encounter.' });
  }
});

app.delete('/api/encounter', requireAuth, (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  try {
    deleteEncounter.run(userId);
    res.status(204).end();
  } catch (error) {
    console.error('Failed to delete encounter', error);
    res.status(500).json({ error: 'Failed to delete encounter.' });
  }
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`Combat tracker API server listening on http://localhost:${PORT}`);
});
