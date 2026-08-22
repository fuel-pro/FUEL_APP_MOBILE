/**
 * CustomersManagement.tsx
 * Customer CRUD with profile and purchase history.
 * Cloud-backed via `customers` DB table + cloudStorageService fallback.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  CheckCircle,
  Users,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import { useFuel } from "@/react-app/context/FuelContext";
import { supabase } from "@/supabase/client";
import { fetchCustomers } from "@/react-app/lib/pos-service";
import cloudStorageService from "@/react-app/lib/cloud-storage-service";
import { formatMoney as fmtMoney } from "@/react-app/lib/currency";
import { switchToTab } from "@/react-app/lib/mpesa-integration-service";
import { toastSuccess, toastError } from "@/react-app/lib/toast";

const formatMoney = (amount: number | null | undefined) =>
  fmtMoney(Number.isFinite(amount as number) ? (amount as number) : 0);

const CLOUD_KEY = "customers_data";

interface Customer {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  credit_limit?: number;
  company?: string;
  tax_id?: string;
  notes?: string;
  is_active?: boolean;
  station_id?: string;
  owner_id?: string;
}

export default function CustomersManagement() {
  const { currentStation } = useStations();
  const { state } = useFuel();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [dataSource, setDataSource] = useState<"database" | "cloud">(
    "database",
  );
  const cloudLoadCompleteRef = useRef(false);

  const loadCustomers = useCallback(async () => {
    if (!currentStation?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Try DB table first
      const data = await fetchCustomers(currentStation.id);
      if (data.length > 0) {
        setCustomers(data);
        setDataSource("database");
        cloudLoadCompleteRef.current = true;
        return;
      }
      // Fallback 1: load from cloud KV store
      const cloudData = await cloudStorageService.get<Customer[]>(
        CLOUD_KEY,
        currentStation.id,
      );
      const normalized = Array.isArray(cloudData) ? cloudData : [];
      if (normalized.length > 0) {
        setCustomers(normalized);
        setDataSource("cloud");
        cloudLoadCompleteRef.current = true;
        return;
      }
      // Fallback 2: read from FuelContext compact blob (state.clients)
      // POS/Invoice tabs save customers here; without this fallback the
      // Customers tab appears empty even though customers exist.
      const compactClients = Object.values(state.clients || {});
      if (compactClients.length > 0) {
        const mapped = compactClients.map((c: any) => ({
          id: c.id || c.phone || c.name,
          name: c.name || c.clientName || "Unknown",
          email: c.email || "",
          phone: c.phone || c.phoneNo || "",
          address: c.address || "",
          company: c.company || c.companyName || "",
          tax_id: c.taxId || c.kraPin || "",
          credit_limit: c.creditLimit || 0,
          notes: c.notes || "",
          is_active: true,
          station_id: currentStation.id,
        }));
        setCustomers(mapped);
        setDataSource("cloud");
        cloudLoadCompleteRef.current = true;
        return;
      }
      setCustomers([]);
      setDataSource("cloud");
      cloudLoadCompleteRef.current = true;
    } catch (error) {
      console.error(
        "[Customers] DB load failed, falling back to cloud:",
        error,
      );
      // Fallback: load from cloud KV store
      try {
        const cloudData = await cloudStorageService.get<Customer[]>(
          CLOUD_KEY,
          currentStation?.id,
        );
        const normalized = Array.isArray(cloudData) ? cloudData : [];
        if (normalized.length > 0) {
          setCustomers(normalized);
          setDataSource("cloud");
        } else {
          // Last resort: FuelContext compact blob
          const compactClients = Object.values(state.clients || {});
          if (compactClients.length > 0) {
            const mapped = compactClients.map((c: any) => ({
              id: c.id || c.phone || c.name,
              name: c.name || c.clientName || "Unknown",
              email: c.email || "",
              phone: c.phone || c.phoneNo || "",
              address: c.address || "",
              company: c.company || c.companyName || "",
              tax_id: c.taxId || c.kraPin || "",
              credit_limit: c.creditLimit || 0,
              notes: c.notes || "",
              is_active: true,
              station_id: currentStation?.id,
            }));
            setCustomers(mapped);
          } else {
            setCustomers([]);
          }
          setDataSource("cloud");
        }
      } catch (cloudError) {
        console.error("[Customers] Cloud fallback also failed:", cloudError);
        setCustomers([]);
        setDataSource("cloud");
      } finally {
        cloudLoadCompleteRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  }, [currentStation?.id, state.clients]);

  useEffect(() => {
    cloudLoadCompleteRef.current = false;
    loadCustomers();
  }, [loadCustomers]);

  // Real-time cloud sync (cloud mode only)
  useEffect(() => {
    if (!currentStation?.id || dataSource !== "cloud") return;
    const unsub = cloudStorageService.subscribe<Customer[]>(
      CLOUD_KEY,
      currentStation.id,
      (data) => {
        if (Array.isArray(data)) setCustomers(data);
      },
    );
    return () => unsub();
  }, [currentStation?.id, dataSource]);

  const persistToCloud = useCallback(
    async (updated: Customer[]) => {
      if (!currentStation?.id) return;
      try {
        await cloudStorageService.set(CLOUD_KEY, updated, currentStation.id);
      } catch (e) {
        console.error("[Customers] Cloud save failed:", e);
      }
    },
    [currentStation?.id],
  );

  const handleSave = async (data: Customer) => {
    if (!currentStation?.id) return;
    if (!data.name?.trim()) {
      toastError("Customer name is required.");
      return;
    }
    if (!cloudLoadCompleteRef.current) {
      toastError("Still loading from cloud. Please try again in a moment.");
      return;
    }
    try {
      if (dataSource === "database") {
        const { data: userData } = await supabase.auth.getUser();
        if (editingCustomer?.id) {
          const { error } = await supabase
            .from("customers")
            .update(data)
            .eq("id", editingCustomer.id);
          if (error) throw error;
          toastSuccess("Customer updated successfully.");
        } else {
          const { error } = await supabase.from("customers").insert({
            ...data,
            station_id: currentStation.id,
            owner_id: userData?.user?.id,
            is_active: true,
          });
          if (error) throw error;
          toastSuccess("Customer added successfully.");
        }
      } else {
        // Cloud KV mode
        if (editingCustomer?.id) {
          const updated = customers.map((c) =>
            c.id === editingCustomer.id ? { ...c, ...data } : c,
          );
          setCustomers(updated);
          await persistToCloud(updated);
          toastSuccess("Customer updated successfully.");
        } else {
          const newCustomer: Customer = {
            ...data,
            id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            is_active: true,
            station_id: currentStation.id,
          };
          const updated = [...customers, newCustomer];
          setCustomers(updated);
          await persistToCloud(updated);
          toastSuccess("Customer added successfully.");
        }
      }
      loadCustomers();
      setShowModal(false);
      setEditingCustomer(null);
    } catch (error: any) {
      console.error("Failed:", error);
      toastError("Failed to save customer: " + (error?.message || error));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    try {
      if (dataSource === "database") {
        const { error } = await supabase
          .from("customers")
          .delete()
          .eq("id", id);
        if (error) throw error;
      } else {
        const updated = customers.filter((c) => c.id !== id);
        setCustomers(updated);
        await persistToCloud(updated);
      }
      toastSuccess("Customer deleted.");
      loadCustomers();
    } catch (error: any) {
      console.error("Failed:", error);
      toastError("Failed to delete customer: " + error.message);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.company?.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex justify-center h-full p-12">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Loading customers...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Customers
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {customers.length} total ·{" "}
              {dataSource === "database" ? "Database synced" : "Cloud synced"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadCustomers()}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-700 dark:text-white rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => {
              setEditingCustomer(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors"
          >
            <Plus size={20} /> Add Customer
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          size={18}
        />
        <input
          type="text"
          placeholder="Search by name, phone, email, or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
        />
      </div>

      {/* Quick Stats */}
      {customers.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3">
            <p className="text-[10px] text-gray-500">Total Customers</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {customers.length}
            </p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3">
            <p className="text-[10px] text-gray-500">With Vehicle</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {customers.filter((c) => c.vehicle_reg || c.vehicleReg).length}
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3">
            <p className="text-[10px] text-gray-500">With Phone</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {customers.filter((c) => c.phone).length}
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3">
            <p className="text-[10px] text-gray-500">With Email</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {customers.filter((c) => c.email).length}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">
              {search ? "No customers match your search" : "No customers yet"}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              {search
                ? "Try a different search term"
                : "Add your first customer to start tracking purchases"}
            </p>
            {!search && (
              <button
                onClick={() => {
                  setEditingCustomer(null);
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors"
              >
                <Plus size={18} /> Add Customer
              </button>
            )}
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
              onClick={() => setSelectedCustomer(customer)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <span className="text-amber-600 dark:text-amber-400 font-bold text-lg">
                    {customer.name?.charAt(0)?.toUpperCase() || "C"}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCustomer(customer);
                      setShowModal(true);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(customer.id!);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h4 className="text-gray-900 dark:text-white font-medium mb-2">
                {customer.name}
              </h4>
              {customer.company && (
                <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2 mb-1">
                  <Building2 size={14} /> {customer.company}
                </p>
              )}
              <div className="space-y-1">
                {customer.phone && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
                    <Phone size={14} /> {customer.phone}
                  </p>
                )}
                {customer.email && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
                    <Mail size={14} /> {customer.email}
                  </p>
                )}
                {customer.address && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-2">
                    <MapPin size={14} /> {customer.address}
                  </p>
                )}
              </div>
              {customer.credit_limit && customer.credit_limit > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Credit Limit
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatMoney(customer.credit_limit)}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <CustomerModal
          customer={editingCustomer}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingCustomer(null);
          }}
        />
      )}

      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}

function CustomerModal({
  customer,
  onSave,
  onClose,
}: {
  customer: Customer | null;
  onSave: (data: Customer) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Customer>(
    customer || {
      name: "",
      email: "",
      phone: "",
      address: "",
      credit_limit: 0,
      company: "",
      tax_id: "",
      notes: "",
    },
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {customer ? "Edit Customer" : "Add Customer"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
              Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              required
            />
          </div>
          <div>
            <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
              Company
            </label>
            <input
              type="text"
              value={form.company || ""}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
              Phone
            </label>
            <input
              type="tel"
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
              Email
            </label>
            <input
              type="email"
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
              Address
            </label>
            <input
              type="text"
              value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                Credit Limit
              </label>
              <input
                type="number"
                value={form.credit_limit || 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    credit_limit: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                min="0"
              />
            </div>
            <div>
              <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
                Tax ID / PIN
              </label>
              <input
                type="text"
                value={form.tax_id || ""}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-gray-500 dark:text-gray-400 text-xs mb-2 block">
              Notes
            </label>
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors resize-none"
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-700 dark:text-white rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle size={18} /> Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CustomerDetailModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSales = async () => {
      if (!customer.id) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("sales_enhanced")
          .select("*, sale_items(*)")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) {
          console.error("Failed to load customer sales:", error.message);
          setSales([]);
        } else {
          setSales(data || []);
        }
      } catch (e) {
        console.error("Failed to load customer sales:", e);
        setSales([]);
      } finally {
        setLoading(false);
      }
    };
    loadSales();
  }, [customer.id]);

  const totalSpent = sales.reduce(
    (sum, s) => sum + (Number(s.total_amount) || 0),
    0,
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Customer Profile
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
              <span className="text-amber-600 dark:text-amber-400 font-bold text-2xl">
                {customer.name?.charAt(0)?.toUpperCase() || "C"}
              </span>
            </div>
            <div>
              <h4 className="text-gray-900 dark:text-white font-semibold text-lg">
                {customer.name}
              </h4>
              {customer.company && (
                <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1">
                  <Building2 size={14} /> {customer.company}
                </p>
              )}
              {customer.phone && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {customer.phone}
                </p>
              )}
            </div>
          </div>

          {/* Contact details */}
          {(customer.email || customer.address || customer.tax_id) && (
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 mb-6 space-y-2">
              {customer.email && (
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <Mail size={14} /> {customer.email}
                </p>
              )}
              {customer.address && (
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <MapPin size={14} /> {customer.address}
                </p>
              )}
              {customer.tax_id && (
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <FileText size={14} /> Tax ID: {customer.tax_id}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">
                Total Orders
              </p>
              <p className="text-gray-900 dark:text-white font-bold text-xl">
                {sales.length}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">
                Total Spent
              </p>
              <p className="text-amber-600 dark:text-amber-400 font-bold text-xl">
                {formatMoney(totalSpent)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => switchToTab("credit")}
              className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-sm rounded-lg border border-indigo-500/30 font-medium transition-colors"
            >
              Create Credit Account
            </button>
            <button
              onClick={() => switchToTab("invoice")}
              className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-sm rounded-lg border border-emerald-500/30 font-medium transition-colors"
            >
              New Invoice
            </button>
            <button
              onClick={() => switchToTab("livetransaction")}
              className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-300 text-sm rounded-lg border border-blue-500/30 font-medium transition-colors"
            >
              Collect via M-PESA
            </button>
          </div>

          <h5 className="text-gray-500 dark:text-gray-400 text-sm mb-3 font-medium">
            Recent Purchases
          </h5>
          {loading ? (
            <div className="text-center py-4">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin mx-auto" />
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                No purchases yet
              </p>
              <button
                onClick={() => switchToTab("pos")}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/30 transition-colors"
              >
                <Plus size={14} /> Record a Sale
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-white/5 rounded-lg"
                >
                  <div>
                    <p className="text-gray-900 dark:text-white text-sm font-medium">
                      {sale.invoice_number || "Sale"}
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-xs">
                      {sale.created_at
                        ? new Date(sale.created_at).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {formatMoney(sale.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
