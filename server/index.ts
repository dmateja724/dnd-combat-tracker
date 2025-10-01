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
  const expectedColumns = new Set(['id', 'user_id', 'name', 'state', 'created_at', 'updated_at']);
  const hasExpectedShape =
    encounterColumns.length === expectedColumns.size &&
    encounterColumns.every((column) => expectedColumns.has(column.name));

  if (!hasExpectedShape) {
    db.exec('DROP TABLE IF EXISTS encounters');
  }

  db.exec(
    `CREATE TABLE IF NOT EXISTS encounters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
     CREATE INDEX IF NOT EXISTS idx_encounters_user ON encounters(user_id);`
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

const selectEncountersByUser = db.prepare(
  `SELECT id, name, created_at, updated_at
   FROM encounters
   WHERE user_id = ?
   ORDER BY datetime(updated_at) DESC`
);

const selectEncounterById = db.prepare(
  `SELECT id, user_id, name, state, created_at, updated_at
   FROM encounters
   WHERE id = ?`
);

const insertEncounter = db.prepare(
  `INSERT INTO encounters (id, user_id, name, state, created_at, updated_at)
   VALUES (@id, @userId, @name, @state, @createdAt, @updatedAt)`
);

const updateEncounterState = db.prepare(
  `UPDATE encounters
   SET state = @state, updated_at = @updatedAt
   WHERE id = @id AND user_id = @userId`
);

const updateEncounterName = db.prepare(
  `UPDATE encounters
   SET name = @name, updated_at = @updatedAt
   WHERE id = @id AND user_id = @userId`
);

const deleteEncounterStmt = db.prepare('DELETE FROM encounters WHERE id = ? AND user_id = ?');

const defaultEncounterState = JSON.stringify({ combatants: [], activeCombatantId: null, round: 1 });

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

const ensureEncounterOwnership = (encounterId: string, userId: string) => {
  const encounter = selectEncounterById.get(encounterId) as
    | {
        id: string;
        user_id: string;
        name: string;
        state: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!encounter || encounter.user_id !== userId) {
    return null;
  }

  return encounter;
};

const serializeEncounterSummary = (row: {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}) => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

app.get('/api/encounters', requireAuth, (req, res) => {
  const { userId } = req as AuthenticatedRequest;

  try {
    const rows = selectEncountersByUser.all(userId) as Array<{
      id: string;
      name: string;
      created_at: string;
      updated_at: string;
    }>;
    res.json(rows.map(serializeEncounterSummary));
  } catch (error) {
    console.error('Failed to list encounters', error);
    res.status(500).json({ error: 'Failed to list encounters.' });
  }
});

app.post('/api/encounters', requireAuth, (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const nameInput = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const now = new Date().toISOString();
  const id = nanoid(16);
  const name = nameInput.length > 0 ? nameInput : `Encounter ${now.slice(0, 10)}`;

  try {
    insertEncounter.run({
      id,
      userId,
      name,
      state: defaultEncounterState,
      createdAt: now,
      updatedAt: now
    });

    res.status(201).json({ id, name, createdAt: now, updatedAt: now });
  } catch (error) {
    console.error('Failed to create encounter', error);
    res.status(500).json({ error: 'Failed to create encounter.' });
  }
});

app.get('/api/encounters/:id', requireAuth, (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const encounterId = req.params.id;

  const encounter = ensureEncounterOwnership(encounterId, userId);
  if (!encounter) {
    res.status(404).json({ error: 'Encounter not found.' });
    return;
  }

  try {
    const payload = JSON.parse(encounter.state);
    res.json({
      id: encounter.id,
      name: encounter.name,
      createdAt: encounter.created_at,
      updatedAt: encounter.updated_at,
      state: payload
    });
  } catch (error) {
    console.error('Stored encounter could not be parsed. Clearing row.', error);
    deleteEncounterStmt.run(encounter.id, userId);
    res.status(404).json({ error: 'Encounter data corrupted. Entry removed.' });
  }
});

app.put('/api/encounters/:id/state', requireAuth, (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const encounterId = req.params.id;
  const encounter = ensureEncounterOwnership(encounterId, userId);

  if (!encounter) {
    res.status(404).json({ error: 'Encounter not found.' });
    return;
  }

  const state = req.body;
  if (!state || typeof state !== 'object') {
    res.status(400).json({ error: 'Encounter payload is required.' });
    return;
  }

  try {
    const serialized = JSON.stringify(state);
    updateEncounterState.run({ id: encounterId, userId, state: serialized, updatedAt: new Date().toISOString() });
    res.status(204).end();
  } catch (error) {
    console.error('Failed to save encounter', error);
    res.status(500).json({ error: 'Failed to save encounter.' });
  }
});

app.patch('/api/encounters/:id', requireAuth, (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const encounterId = req.params.id;
  const encounter = ensureEncounterOwnership(encounterId, userId);

  if (!encounter) {
    res.status(404).json({ error: 'Encounter not found.' });
    return;
  }

  const nameInput = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!nameInput) {
    res.status(400).json({ error: 'Encounter name is required.' });
    return;
  }

  try {
    const updatedAt = new Date().toISOString();
    updateEncounterName.run({ id: encounterId, userId, name: nameInput, updatedAt });
    res.json({
      id: encounterId,
      name: nameInput,
      createdAt: encounter.created_at,
      updatedAt
    });
  } catch (error) {
    console.error('Failed to rename encounter', error);
    res.status(500).json({ error: 'Failed to rename encounter.' });
  }
});

app.delete('/api/encounters/:id', requireAuth, (req, res) => {
  const { userId } = req as AuthenticatedRequest;
  const encounterId = req.params.id;

  try {
    const info = deleteEncounterStmt.run(encounterId, userId);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Encounter not found.' });
      return;
    }
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
