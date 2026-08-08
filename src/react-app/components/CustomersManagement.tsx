/**
 * CustomersManagement.tsx
 * Customer CRUD with profile and purchase history.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Edit2, Trash2, X, Loader2, CheckCircle, Users, Phone, Mail, MapPin } from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import { supabase } from "@/supabase/client";
import { fetchCustomers } from "@/react-app/lib/pos-service";

const formatMoney = (amount: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(amount);

export default function CustomersManagement() {
  const { currentStation } = useStations();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const loadCustomers = useCallback(async () => {
    if (!currentStation?.id) return;
    setLoading(true);
    try {
      const data = await fetchCustomers(currentStation.id);
      setCustomers(data);
    } catch (error) {
      console.error("Failed:", error);
    } finally {
      setLoading(false);
    }
  }, [currentStation?.id]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const handleSave = async (data: any) => {
    if (!currentStation?.id) return;
    const { data: userData } = await supabase.auth.getUser();
    try {
      if (editingCustomer) {
        await supabase.from("customers").update(data).eq("id", editingCustomer.id);
      } else {
        await supabase.from("customers").insert({ ...data, station_id: currentStation.id, owner_id: userData?.user?.id });
      }
      loadCustomers();
      setShowModal(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error("Failed:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    await supabase.from("customers").delete().eq("id", id);
    loadCustomers();
  };

  const filteredCustomers = customers.filter((c) => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));

  if (loading) {
    return <div className="flex justify-center h-full"><div className="text-center"><Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" /><p className="text-gray-400">Loading...</p></div></div>;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-white">Customers</h1>
        <button onClick={() => { setEditingCustomer(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
          <Plus size={20} /> Add Customer
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input type="text" placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full text-center py-12"><Users className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No customers</p></div>
        ) : filteredCustomers.map((customer) => (
          <div key={customer.id} className="bg-white/5 border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-white/10" onClick={() => setSelectedCustomer(customer)}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                <span className="text-amber-400 font-bold text-lg">{customer.name?.charAt(0) || "C"}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={(e) => { e.stopPropagation(); setEditingCustomer(customer); setShowModal(true); }} className="p-2 text-gray-400 hover:text-white"><Edit2 size={16} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }} className="p-2 text-gray-400 hover:text-red-400"><Trash2 size={16} /></button>
              </div>
            </div>
            <h4 className="text-white font-medium mb-2">{customer.name}</h4>
            <div className="space-y-1">
              {customer.phone && <p className="text-gray-400 text-sm flex items-center gap-2"><Phone size={14} /> {customer.phone}</p>}
              {customer.email && <p className="text-gray-400 text-sm flex items-center gap-2"><Mail size={14} /> {customer.email}</p>}
              {customer.address && <p className="text-gray-400 text-sm flex items-center gap-2"><MapPin size={14} /> {customer.address}</p>}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <CustomerModal customer={editingCustomer} onSave={handleSave} onClose={() => { setShowModal(false); setEditingCustomer(null); }} />
      )}

      {selectedCustomer && (
        <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}

function CustomerModal({ customer, onSave, onClose }: { customer: any; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState(customer || { name: "", email: "", phone: "", address: "", credit_limit: 0 });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-white/10">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white">{customer ? "Edit Customer" : "Add Customer"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="p-6 space-y-4">
          <div><label className="text-gray-400 text-xs mb-2 block">Name *</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" required /></div>
          <div><label className="text-gray-400 text-xs mb-2 block">Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" /></div>
          <div><label className="text-gray-400 text-xs mb-2 block">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" /></div>
          <div><label className="text-gray-400 text-xs mb-2 block">Address</label><input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" /></div>
          <div><label className="text-gray-400 text-xs mb-2 block">Credit Limit</label><input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white" min="0" /></div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl">Cancel</button>
            <button type="submit" className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl flex items-center justify-center gap-2"><CheckCircle size={18} /> Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerDetailModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSales = async () => {
      const { data } = await supabase.from("sales_enhanced").select("*, sale_items(*)").eq("customer_id", customer.id).order("created_at", { ascending: false }).limit(10);
      setSales(data || []);
      setLoading(false);
    };
    loadSales();
  }, [customer.id]);

  const totalSpent = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white">Customer Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
              <span className="text-amber-400 font-bold text-2xl">{customer.name?.charAt(0) || "C"}</span>
            </div>
            <div>
              <h4 className="text-white font-semibold text-lg">{customer.name}</h4>
              {customer.phone && <p className="text-gray-400">{customer.phone}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-1">Total Orders</p>
              <p className="text-white font-bold text-xl">{sales.length}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-1">Total Spent</p>
              <p className="text-amber-400 font-bold text-xl">{formatMoney(totalSpent)}</p>
            </div>
          </div>
          <h5 className="text-gray-400 text-sm mb-3">Recent Purchases</h5>
          {loading ? <div className="text-center py-4"><Loader2 className="w-6 h-6 text-amber-500 animate-spin mx-auto" /></div> : sales.length === 0 ? <p className="text-gray-500 text-center py-4">No purchases</p> : (
            <div className="space-y-2">
              {sales.map((sale) => (
                <div key={sale.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <div><p className="text-white text-sm">{sale.invoice_number}</p><p className="text-gray-500 text-xs">{new Date(sale.created_at).toLocaleDateString()}</p></div>
                  <span className="text-amber-400 font-medium">{formatMoney(sale.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
