-- Migration 012: fuel_prices PostGIS smart-cache (ADAPTED to existing schema)
--
-- The live `fuel_prices` table already existed (from earlier fuel-price work)
-- with a PostGIS `location` geography column, GiST index `idx_fuel_location`,
-- a `prices` jsonb column, and a unique constraint on (location_name, country).
-- This migration ADDS the two pieces the spec needs that were missing:
--   1. A trigger that auto-populates `location` from `lat`/`lon` on insert/update
--      (the existing trigger only refreshed `last_updated`).
--   2. The `get_nearest_fuel_prices` RPC used by the hybrid fetcher to find the
--      nearest cached town within a radius (saves SerpApi quota).

-- Enable PostGIS (idempotent; was already enabled by the earlier migration).
create extension if not exists postgis;

-- Trigger function: refresh last_updated AND auto-populate the geography
-- column from lat/lon so inserts that only provide coordinates still get a
-- spatial point (the RPC and GiST index depend on it).
create or replace function update_fuel_prices_last_updated()
returns trigger as $$
begin
  NEW.last_updated = NOW();
  if NEW.lat is not null and NEW.lon is not null then
    NEW.location := st_setSRID(st_makePoint(NEW.lon, NEW.lat), 4326)::geography;
  end if;
  return NEW;
end;
$$ language plpgsql;

-- RPC: nearest cached town within `radius_km` of (user_lat, user_lon).
-- st_distance returns double precision, so the return column is double precision.
drop function if exists get_nearest_fuel_prices(numeric, numeric, numeric);
create function get_nearest_fuel_prices(user_lat numeric, user_lon numeric, radius_km numeric)
returns table (
  location_name text, country text, distance_km double precision,
  prices jsonb, currency text, last_updated timestamp with time zone
) as $$
begin
  return query
  select
    f.location_name, f.country,
    st_distance(f.location, st_setSRID(st_makePoint(user_lon, user_lat), 4326)::geography) / 1000 as distance_km,
    f.prices, f.currency, f.last_updated
  from fuel_prices f
  where st_dwithin(f.location, st_setSRID(st_makePoint(user_lon, user_lat), 4326)::geography, radius_km * 1000)
  order by distance_km asc limit 1;
end;
$$ language plpgsql;

-- RLS: fuel prices are public reference data — anyone can read, only the
-- service role (server-side, bypasses RLS) can write.
alter table fuel_prices enable row level security;
drop policy if exists "fuel_prices_public_read" on fuel_prices;
create policy "fuel_prices_public_read" on fuel_prices for select using (true);
