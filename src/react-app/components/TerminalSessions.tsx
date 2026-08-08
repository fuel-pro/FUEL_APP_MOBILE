/**
 * TerminalSessions.tsx
 * Terminal sessions: open/close shifts, cash reconciliation, variance.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Plus, X, Loader2, CheckCircle, Clock, DollarSign, AlertTriangle } from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import { supabase } from "@/supabase/client";
import { openTerminalSession, closeTerminalSession } from "@/react-app/lib/pos-service";

const formatMoney = (amount: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(amount);

export default function TerminalSessions() {
  const { currentStation } = useStations();
  const [sessions, setSessions] = useState<any[]>([]);
  const [openSession, setOpenSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingSession, setClosingSession] = useState<any>(null);
  const [openingCash, setOpeningCash] = useState(0);
  const [countedCash, setCountedCash] = useState(0);

  const loadSessions = useCallback(async () => {
    if (!currentStation?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase.from("terminal_sessions").select("*").eq("station_id", currentStation.id).order("created_at", { ascending: false }).limit(20);
      setSessions(data || []);
      setOpenSession(data?.find((s) => s.status === "open") || null);
    } catch (error) {
      console.error("Failed:", error);
    } finally {
      setLoading(false);
    }
  }, [currentStation?.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleOpenSession = async () => {
    if (!currentStation?.id) return;
    setLoading(true);
    try {
      await openTerminalSession(currentStation.id, openingCash);
      setShowOpenModal(false);
      setOpeningCash(0);
      loadSessions();
    } catch (error) {
      console.error("Failed:", error);
      alert("Failed to open session");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!closingSession) return;
    setLoading(true);
    try {
      const result = await closeTerminalSession(closingSession.id, countedCash);
      if (result.success) {
        setShowCloseModal(false);
        setClosingSession(null);
        setCountedCash(0);
        loadSessions();
      } else {
        alert(result.error || "Failed to close session");
      }
    } catch (error) {
      console.error("Failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const openSessionsTotal = openSession ? (openSession.cash_sales || 0) + (openSession.mpesa_sales || 0) + (openSession.card_sales || 0) + (openSession.opening_cash || 0) : 0;

  if (loading) {
    return <div className="flex justify-center h-full"><div className="text-center"><Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" /><p className="text-gray-400">Loading...</p></div></div>;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">Terminal Sessions</h1>
        {!openSession && (
          <button onClick={() => setShowOpenModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl">
            <Plus size={20} /> Open Session
          </button>
        )}
      </div>

      {/* Active Session */}
      {openSession && (
        <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-400 font-semibold">Session Active</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-300">{openSession.session_number}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div><p className="text-gray-400 text-xs mb-1">Opening Cash</p><p className="text-white font-medium">{formatMoney(openSession.opening_cash)}</p></div>
            <div><p className="text-gray-400 text-xs mb-1">Cash Sales</p><p className="text-emerald-400 font-medium">{formatMoney(openSession.cash_sales)}</p></div>
            <div><p className="text-gray-400 text-xs mb-1">M-PESA</p><p className="text-blue-400 font-medium">{formatMoney(openSession.mpesa_sales)}</p></div>
            <div><p className="text-gray-400 text-xs mb-1">Card</p><p className="text-purple-400 font-medium">{formatMoney(openSession.card_sales)}</p></div>
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-emerald-500/20">
            <div><p className="text-gray-400 text-sm">Expected Cash</p><p className="text-white text-2xl font-bold">{formatMoney(openSessionsTotal)}</p></div>
            <button onClick={() => { setClosingSession(openSession); setShowCloseModal(true); }} className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl">Close Session</button>
          </div>
        </div>
      )}

      {/* Session History */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10"><h3 className="text-white font-semibold">Session History</h3></div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">Session</th>
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">Opened</th>
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">Closed</th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">Sales</th>
              <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">Variance</th>
              <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.filter((s) => s.status !== "open").length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12"><Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No session history</p></td></tr>
            ) : sessions.filter((s) => s.status !== "open").map((session) => (
              <tr key={session.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-4 text-white font-medium">{session.session_number}</td>
                <td className="px-4 py-4 text-gray-300 text-sm">{new Date(session.opening_time).toLocaleString()}</td>
                <td className="px-4 py-4 text-gray-300 text-sm">{session.closing_time ? new Date(session.closing_time).toLocaleString() : "-"}</td>
                <td className="px-4 py-4 text-right text-amber-400 font-medium">{formatMoney(session.total_sales)}</td>
                <td className={`px-4 py-4 text-right font-medium ${session.variance > 0 ? "text-emerald-400" : session.variance < 0 ? "text-red-400" : "text-gray-300"}`}>
                  {session.variance ? formatMoney(session.variance) : "-"}
                </td>
                <td className="px-4 py-4"><span className={`text-xs px-2 py-1 rounded-full ${session.status === "closed" ? "bg-gray-500/20 text-gray-400" : "bg-amber-500/20 text-amber-400"}`}>{session.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Open Session Modal */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white">Open Session</h3>
              <button onClick={() => setShowOpenModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Opening Cash (Float)</label>
                <input type="number" value={openingCash} onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" min="0" />
              </div>
              <button onClick={handleOpenSession} disabled={loading} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white font-medium rounded-xl flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Start Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Session Modal */}
      {showCloseModal && closingSession && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-white/10">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white">Close Session</h3>
              <button onClick={() => { setShowCloseModal(false); setClosingSession(null); }} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-white/5 rounded-xl p-4 space-y-2">
                <div className="flex justify-between"><span className="text-gray-400">Opening Cash</span><span className="text-white">{formatMoney(closingSession.opening_cash)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Cash Sales</span><span className="text-white">{formatMoney(closingSession.cash_sales)}</span></div>
                <div className="flex justify-between font-semibold"><span className="text-gray-300">Expected</span><span className="text-white">{formatMoney(openSessionsTotal)}</span></div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Counted Cash</label>
                <input type="number" value={countedCash} onChange={(e) => setCountedCash(parseFloat(e.target.value) || 0)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" min="0" />
              </div>
              {countedCash !== openSessionsTotal && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${countedCash > openSessionsTotal ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                  <AlertTriangle size={18} />
                  <span>Variance: {formatMoney(countedCash - openSessionsTotal)}</span>
                </div>
              )}
              <button onClick={handleCloseSession} disabled={loading} className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white font-medium rounded-xl flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Close & Reconcile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
