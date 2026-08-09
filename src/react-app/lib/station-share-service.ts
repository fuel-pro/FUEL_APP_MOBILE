/**
 * Station Sharing Service — DB-backed cross-device station access sharing.
 *
 * Uses the `station_members` table (Supabase, RLS-protected) as the source of
 * truth. Allows a station owner to invite users by email; invited users can
 * accept/reject from any device. localStorage is used only as a read-through
 * cache — all writes go to Supabase first.
 */

import { getSupabaseClient } from "@/supabase/client";

export interface StationMember {
  id: string;
  station_id: string;
  user_id: string | null;
  invited_email: string | null;
  name: string | null;
  role: string;
  status: "pending" | "accepted" | "rejected";
  invite_token: string | null;
  created_at: string;
  updated_at: string;
}

const CACHE_KEY = "fuelpro_station_members_cache";

function readCache(): StationMember[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCache(members: StationMember[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(members));
  } catch {
    // quota — ignore, cloud is source of truth
  }
}

function genToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function inviteMember(
  stationId: string,
  email: string,
  role: string = "staff",
  name?: string
): Promise<{ success: boolean; error?: string; member?: StationMember }> {
  const supabase = getSupabaseClient();
  const token = genToken();

  const { data, error } = await supabase
    .from("station_members")
    .insert({
      station_id: stationId,
      invited_email: email,
      name: name || email.split("@")[0],
      role,
      status: "pending",
      invite_token: token,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  const member = data as StationMember;
  const cache = readCache().filter((m) => m.id !== member.id);
  cache.push(member);
  writeCache(cache);

  // Build a shareable invite link
  const inviteUrl = `${window.location.origin}/?invite=${token}`;
  return { success: true, member, error: inviteUrl };
}

export async function getStationMembers(stationId: string): Promise<StationMember[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("station_members")
    .select("*")
    .eq("station_id", stationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[shareService] getStationMembers error:", error.message);
    return readCache().filter((m) => m.station_id === stationId);
  }

  const members = (data || []) as StationMember[];
  writeCache(members);
  return members;
}

export async function acceptInvite(token: string): Promise<{ success: boolean; error?: string; stationId?: string }> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in to accept an invite" };

  // Find the invite by token
  const { data: invite, error: findErr } = await supabase
    .from("station_members")
    .select("*")
    .eq("invite_token", token)
    .eq("status", "pending")
    .single();

  if (findErr || !invite) {
    return { success: false, error: "Invalid or expired invite link" };
  }

  // Accept the invite — set user_id and status
  const { error: updateErr } = await supabase
    .from("station_members")
    .update({ user_id: user.id, status: "accepted" })
    .eq("id", (invite as StationMember).id);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  return { success: true, stationId: (invite as StationMember).station_id };
}

export async function revokeMember(memberId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("station_members")
    .delete()
    .eq("id", memberId);

  if (error) {
    return { success: false, error: error.message };
  }

  const cache = readCache().filter((m) => m.id !== memberId);
  writeCache(cache);
  return { success: true };
}

export async function getSharedStations(): Promise<StationMember[]> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get memberships where this user is accepted
  const { data, error } = await supabase
    .from("station_members")
    .select("*")
    .or(`user_id.eq.${user.id},invited_email.eq.${user.email}`)
    .eq("status", "accepted")
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[shareService] getSharedStations error:", error.message);
    return [];
  }

  return (data || []) as StationMember[];
}

export async function checkPendingInvite(): Promise<{ token: string; stationId: string } | null> {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("invite");
  if (!token) return null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("station_members")
    .select("station_id, status")
    .eq("invite_token", token)
    .single();

  if (error || !data) return null;
  const row = data as { station_id: string; status: string };
  if (row.status !== "pending") return null;

  return { token, stationId: row.station_id };
}
