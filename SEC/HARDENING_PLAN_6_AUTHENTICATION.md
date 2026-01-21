# Security Hardening Plan 6: Authentication for File Browser (/api/files) + User Signup/Login

## Problem

### Current Code
```typescript
// ❌ VULNERABLE - No authentication
export async function GET(request: NextRequest) {
  // Anyone can access
  const files = await fs.readdir(BUNDLES_DIR);
  // Read all files
}

export async function POST(request: NextRequest) {
  // Anyone can write files
  const { action, name, content } = body;
  await fs.writeFile(filePath, content);
}
```

### Risks
- **Unauthorized Access**: Anyone can browse/modify files
- **Data Leakage**: All public and dist directories exposed
- **File Injection**: Arbitrary files can be uploaded
- **Privilege Escalation**: User could write to protected dirs

## Solution: Authentication + User Management

### Step 1: Create User Database Schema

```typescript
// src/lib/db/schema.ts

import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, boolean, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  email: text('email').unique().notNull(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`),
  isActive: boolean('is_active').default(true).notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
});

export const fileAccessLogs = pgTable('file_access_logs', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'read', 'write', 'delete'
  filePath: text('file_path').notNull(),
  status: text('status').notNull(), // 'success', 'denied', 'error'
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
});

export const userPermissions = pgTable('user_permissions', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  canRead: boolean('can_read').default(true),
  canWrite: boolean('can_write').default(false),
  canDelete: boolean('can_delete').default(false),
  allowedDirs: text('allowed_dirs').default('["public"]'), // JSON array
  createdAt: timestamp('created_at').default(sql`now()`),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type UserPermission = typeof userPermissions.$inferSelect;
```

### Step 2: Create Auth Service

```typescript
// src/lib/auth/authService.ts

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { users, sessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthCredentials {
  email: string;
  username: string;
  password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export class AuthService {
  // ✅ Hash password with bcrypt
  static async hashPassword(password: string): Promise<string> {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    return bcrypt.hash(password, 12);
  }

  // ✅ Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // ✅ Register new user
  static async register(creds: AuthCredentials) {
    // Validate input
    if (!creds.email || !creds.username || !creds.password) {
      throw new Error('Email, username, and password are required');
    }

    if (!this.isValidEmail(creds.email)) {
      throw new Error('Invalid email format');
    }

    if (creds.username.length < 3 || creds.username.length > 32) {
      throw new Error('Username must be 3-32 characters');
    }

    // Check if user exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, creds.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await this.hashPassword(creds.password);

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        email: creds.email.toLowerCase(),
        username: creds.username,
        passwordHash,
      })
      .returning();

    // Create session
    const token = await this.createSession(user.id);

    return {
      user: { id: user.id, email: user.email, username: user.username },
      token,
    };
  }

  // ✅ Login user
  static async login(creds: LoginCredentials) {
    if (!creds.email || !creds.password) {
      throw new Error('Email and password are required');
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, creds.email.toLowerCase()))
      .limit(1);

    if (!user) {
      // ✅ Don't reveal if email exists
      throw new Error('Invalid email or password');
    }

    const validPassword = await this.verifyPassword(creds.password, user.passwordHash);
    if (!validPassword) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    // Create session
    const token = await this.createSession(user.id);

    return {
      user: { id: user.id, email: user.email, username: user.username },
      token,
    };
  }

  // ✅ Create session token
  private static async createSession(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    await db.insert(sessions).values({
      userId,
      token,
      expiresAt,
    });

    return token;
  }

  // ✅ Validate session token
  static async validateSession(token: string) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token))
      .limit(1);

    if (!session) {
      throw new Error('Invalid session');
    }

    if (new Date() > session.expiresAt) {
      // Clean up expired session
      await db.delete(sessions).where(eq(sessions.token, token));
      throw new Error('Session expired');
    }

    // Extend session
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION);
    await db
      .update(sessions)
      .set({ expiresAt: newExpiresAt })
      .where(eq(sessions.token, token));

    return session.userId;
  }

  // ✅ Logout
  static async logout(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  // ✅ Get user with permissions
  static async getUserWithPermissions(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Get permissions (with defaults)
    let [perms] = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId))
      .limit(1);

    if (!perms) {
      // Create default permissions for new user
      [perms] = await db
        .insert(userPermissions)
        .values({
          userId,
          canRead: true,
          canWrite: false,
          canDelete: false,
          allowedDirs: JSON.stringify(['public']),
        })
        .returning();
    }

    return { user, permissions: perms };
  }

  private static isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
```

### Step 3: Create Auth Middleware

```typescript
// src/middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth/authService';

export async function middleware(request: NextRequest) {
  // Protected routes
  const protectedRoutes = ['/api/files', '/api/keypair', '/api/bundle-cache'];
  const isProtected = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  if (isProtected) {
    const token = extractToken(request);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const userId = await AuthService.validateSession(token);
      // Attach userId to request
      const headers = new Headers(request.headers);
      headers.set('x-user-id', userId);
      return NextResponse.next({ request: { headers } });
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export const config = {
  matcher: ['/api/:path*'],
};
```

### Step 4: Create Auth API Routes

```typescript
// src/app/api/auth/signup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth/authService';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  username: z.string().min(3).max(32),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ✅ Validate with Zod
    const validated = signupSchema.parse(body);

    // ✅ Register user
    const result = await AuthService.register({
      email: validated.email,
      username: validated.username,
      password: validated.password,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Signup failed' },
      { status: 400 }
    );
  }
}
```

```typescript
// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth/authService';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = loginSchema.parse(body);

    const result = await AuthService.login({
      email: validated.email,
      password: validated.password,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 401 }
    );
  }
}
```

```typescript
// src/app/api/auth/logout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth/authService';

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');

  if (token) {
    await AuthService.logout(token);
  }

  return NextResponse.json({ success: true });
}
```

### Step 5: Update Files API with Auth

```typescript
// src/app/api/files/route.ts - Updated

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { AuthService } from '@/lib/auth/authService';
import { logFileAccess } from '@/lib/fileAccessLogger';

const ALLOWED_ROOTS = ['public', 'dist'];

export async function GET(request: NextRequest) {
  // ✅ Get authenticated user
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ✅ Get user permissions
  const { permissions } = await AuthService.getUserWithPermissions(userId);

  if (!permissions.canRead) {
    await logFileAccess(userId, 'read', '/', 'denied');
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const root = searchParams.get('root') || 'public';
  const dir = searchParams.get('dir') || '';

  // ✅ Enforce allowed directories
  const allowedDirs = JSON.parse(permissions.allowedDirs || '["public"]');
  if (!allowedDirs.includes(root)) {
    await logFileAccess(userId, 'read', root, 'denied');
    return NextResponse.json({ error: 'Access denied to this directory' }, { status: 403 });
  }

  try {
    const fullPath = path.join(process.cwd(), root, dir);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const items = await Promise.all(
      entries.map(async (entry) => {
        const itemPath = path.join(fullPath, entry.name);
        const stats = await fs.stat(itemPath);
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      })
    );

    await logFileAccess(userId, 'read', path.join(root, dir), 'success');

    return NextResponse.json({ items, root, path: dir });
  } catch (error: any) {
    await logFileAccess(userId, 'read', path.join(root, dir), 'error');
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // ✅ Get authenticated user
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ✅ Get user permissions
  const { permissions } = await AuthService.getUserWithPermissions(userId);

  const body = await request.json();
  const { root, action } = body;

  // ✅ Check write permission
  if (['create-file', 'save', 'upload', 'delete'].includes(action)) {
    if (!permissions.canWrite) {
      await logFileAccess(userId, action, root, 'denied');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  // ✅ Enforce allowed directories
  const allowedDirs = JSON.parse(permissions.allowedDirs || '["public"]');
  if (!allowedDirs.includes(root)) {
    await logFileAccess(userId, action, root, 'denied');
    return NextResponse.json({ error: 'Access denied to this directory' }, { status: 403 });
  }

  try {
    // ... existing file operations ...
    await logFileAccess(userId, action, root, 'success');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await logFileAccess(userId, action, root, 'error');
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Step 6: Create Login Page

```typescript
// src/app/auth/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const payload = isLogin
        ? { email, password }
        : { email, username, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Authentication failed');
      }

      const { token } = await response.json();

      // Save token to localStorage
      localStorage.setItem('auth_token', token);

      // Redirect to file browser
      router.push('/files');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-8 p-6 border rounded-lg">
      <h2 className="text-2xl font-bold mb-6">
        {isLogin ? 'Login' : 'Sign Up'}
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 border rounded"
        />

        {!isLogin && (
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded"
          />
        )}

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full px-3 py-2 border rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>

      <button
        onClick={() => setIsLogin(!isLogin)}
        className="mt-4 text-blue-600 hover:underline text-sm"
      >
        {isLogin ? 'Need an account? Sign up' : 'Have an account? Login'}
      </button>
    </div>
  );
}
```

## Security Benefits

✅ **Password Hashing**: bcrypt with 12 rounds  
✅ **Session Management**: Cryptographically secure tokens  
✅ **Permission Model**: Role-based access control  
✅ **Access Logging**: Track all file operations  
✅ **Account Lockout**: Can implement after N failed attempts  
✅ **Password Requirements**: Minimum 8 characters enforced  
✅ **Email Validation**: Prevents fake accounts  
✅ **Audit Trail**: All operations logged with user ID  

## Database Setup

```bash
# Install dependencies
npm install drizzle-orm drizzle-kit pg bcrypt

# Create .env
DATABASE_URL=postgresql://user:password@localhost/db

# Run migrations
npx drizzle-kit push:pg

# Generate migration files
npx drizzle-kit generate:pg
```

## Rollout Plan

1. Create database schema
2. Implement AuthService
3. Add auth middleware
4. Update file API with permissions
5. Create login/signup pages
6. Test authentication flow
7. Add rate limiting to auth endpoints
8. Add 2FA (optional, future)
