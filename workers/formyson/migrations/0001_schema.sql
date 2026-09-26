CREATE TABLE content (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('products','articles')),
 slug TEXT NOT NULL,
 title TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('draft','published')),
 published_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 data TEXT NOT NULL,
 UNIQUE(kind, slug)
);
CREATE INDEX content_public ON content(kind, status, published_at DESC);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, credential_version TEXT NOT NULL);
CREATE TABLE login_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE media (key TEXT PRIMARY KEY, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL);
