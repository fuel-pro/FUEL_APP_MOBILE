-- 027_station_qr_access.sql
-- Secure one-tap QR access grants for station sharing.
--
-- PROBLEM (fixed here): the Header "Company QR Code" encoded only static
-- company data via a THIRD-PARTY service (api.qrserver.com) — leaking
-- company VAT/taxId/phone to an external provider, with NO access grant,
-- NO expiry, and NO revocation. Sharing it granted nothing and downloading
-- required external internet.
--
-- SOLUTION: a `station_qr_grants` table (owner-scoped RLS CRUD) + a
-- SECURITY DEFINER RPC `redeem_station_qr_access` that an UNAUTHENTICATED
-- recipient can call with the opaque token from the QR. The RPC atomically:
--   * looks up the grant by (station_id, token),
--   * rejects when disabled or expired or max_uses reached,
--   * bumps used_count / last_used_at ONCE (row lock),
--   * returns the access config (member label, role, allowed tabs,
--     read-only, expiry) so the recipient's device can open the read-only
--     Station Access snapshot viewer — no username/password entry.
--
-- The token is 32+ random bytes (crypto.getRandomValues) — never derived
-- from company data — so the QR is unguessable, revocable (disable/delete
-- the row) and self-expiring (expires_at).

create table if not exists station_qr_grants (
  token           text primary key,        -- opaque random token (not stored hashed: it IS the credential, like an invite link)
  station_id      text not null,
  owner_id        uuid not null,
  member_label    text not null default 'Guest',  -- display name shown in the viewer
  member_role     text not null default 'Guest',  -- role badge
  allowed_tabs    jsonb not null default '[]'::jsonb,  -- empty = all read-only tabs
  read_only       boolean not null default true,
  expires_at      timestamptz not null,     -- after this, the QR stops working
  max_uses        integer not null default 0, -- 0 = unlimited
  used_count      integer not null default 0,
  enabled         boolean not null default true,
  note            text not null default '',
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

create index if not exists station_qr_grants_owner_station_idx
  on station_qr_grants (owner_id, station_id);

-- RLS: the OWNER (auth.uid() = owner_id) can CRUD their own grants.
alter table station_qr_grants enable row level security;

drop policy if exists station_qr_grants_owner_select on station_qr_grants;
create policy station_qr_grants_owner_select
  on station_qr_grants for select
  using (auth.uid() = owner_id);

drop policy if exists station_qr_grants_owner_insert on station_qr_grants;
create policy station_qr_grants_owner_insert
  on station_qr_grants for insert
  with check (auth.uid() = owner_id);

drop policy if exists station_qr_grants_owner_update on station_qr_grants;
create policy station_qr_grants_owner_update
  on station_qr_grants for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists station_qr_grants_owner_delete on station_qr_grants;
create policy station_qr_grants_owner_delete
  on station_qr_grants for delete
  using (auth.uid() = owner_id);

-- SECURITY DEFINER redeem RPC — callable by anon (the QR recipient has no
-- Supabase session). Returns the access config or an error marker. Uses a
-- row lock so concurrent redemptions can't exceed max_uses.
create or replace function public.redeem_station_qr_access(
  p_station_id text,
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g station_qr_grants%rowtype;
begin
  select * into g from station_qr_grants
   where station_id = p_station_id and token = p_token
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if g.enabled = false then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  if g.expires_at is not null and g.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if g.max_uses > 0 and g.used_count >= g.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'max_uses');
  end if;

  update station_qr_grants
     set used_count = used_count + 1, last_used_at = now()
   where token = p_token;

  return jsonb_build_object(
    'ok', true,
    'stationId', g.station_id,
    'ownerId', g.owner_id::text,
    'memberLabel', g.member_label,
    'memberRole', g.member_role,
    'allowedTabs', g.allowed_tabs,
    'readOnly', g.read_only,
    'expiresAt', to_char(g.expires_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'maxUses', g.max_uses,
    'usedCount', g.used_count + 1
  );
end;
$$;

-- POSTGRES NOTE: the RPC references the table directly (SECURITY DEFINER)
-- so the anon role needs only EXECUTE on the function, not table grants.
revoke all on function public.redeem_station_qr_access(text, text) from public;
grant execute on function public.redeem_station_qr_access(text, text) to anon, authenticated;