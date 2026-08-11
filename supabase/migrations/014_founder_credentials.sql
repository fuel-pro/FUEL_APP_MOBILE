-- Founder credentials table: maps a username to a Supabase auth email + unique_id
-- This enables username-based login (e.g. "FOUNDER" -> leonibuyanawose@gmail.com)
CREATE TABLE IF NOT EXISTS founder_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  auth_email text NOT NULL,
  unique_id text,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: public can read (needed for login lookup — password still protects auth);
-- only founder/admin users can write.
ALTER TABLE founder_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "founder_creds_public_read" ON founder_credentials;
CREATE POLICY "founder_creds_public_read" ON founder_credentials
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "founder_creds_founder_write" ON founder_credentials;
CREATE POLICY "founder_creds_founder_write" ON founder_credentials
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM users WHERE role IN ('founder', 'admin'))
  ) WITH CHECK (
    auth.uid() IN (SELECT id FROM users WHERE role IN ('founder', 'admin'))
  );

-- Seed default: username FOUNDER -> leonibuyanawose@gmail.com
INSERT INTO founder_credentials (username, auth_email, unique_id, display_name, is_active)
VALUES ('FOUNDER', 'leonibuyanawose@gmail.com', '22D838D0-FPR', 'Founder', true)
ON CONFLICT (username) DO UPDATE SET
  auth_email = EXCLUDED.auth_email,
  unique_id = EXCLUDED.unique_id,
  display_name = EXCLUDED.display_name,
  is_active = true,
  updated_at = now();

-- Set the founder's profiles.username too
UPDATE profiles SET username = 'FOUNDER' WHERE id = 'c847d526-cb7a-4da4-bbf0-f8e092ed77ce';
