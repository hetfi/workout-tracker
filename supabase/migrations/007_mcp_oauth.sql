-- MCP OAuth 2.1 tables for ChatGPT integration (Phase 1: read-only)
-- All access via service role key; no RLS needed on these tables.

-- Short-lived authorization codes (PKCE flow)
CREATE TABLE mcp_oauth_authorization_codes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash             TEXT        NOT NULL UNIQUE,
  user_id               UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  client_id             TEXT        NOT NULL,
  redirect_uri          TEXT        NOT NULL,
  scope                 TEXT        NOT NULL DEFAULT 'read:workouts',
  code_challenge        TEXT        NOT NULL,
  code_challenge_method TEXT        NOT NULL DEFAULT 'S256',
  expires_at            TIMESTAMPTZ NOT NULL,
  used_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Access tokens and refresh tokens
CREATE TABLE mcp_oauth_tokens (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  client_id                 TEXT        NOT NULL,
  access_token_hash         TEXT        NOT NULL UNIQUE,
  refresh_token_hash        TEXT        UNIQUE,
  scope                     TEXT        NOT NULL DEFAULT 'read:workouts',
  access_token_expires_at   TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at  TIMESTAMPTZ,
  last_used_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX mcp_auth_codes_user_id_idx ON mcp_oauth_authorization_codes(user_id);
CREATE INDEX mcp_tokens_user_id_idx     ON mcp_oauth_tokens(user_id);
-- Automatically purge expired/used codes (optional; run via pg_cron or manual cleanup)
