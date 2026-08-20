/**
 * AdvancedPOS.tsx
 * Full-featured Point of Sale with product grid, cart, and checkout.
 * All subcomponents are module-scoped (UPDATE-4 rule).
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  User,
  Receipt,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useStations } from "@/react-app/context/StationContext";
import {
  fetchProducts,
  fetchCustomers,
  fetchOpenSessions,
  processPOSCheckout,
  calculateCartTotals,
  openTerminalSession,
} from "@/react-app/lib/pos-service";
import type { POSItem, POSCart } from "@/react-app/lib/pos-service";
import {
  getCurrencySymbol,
  getDetectedCurrency,
  isKenyaStation,
} from "@/react-app/lib/currency";

// Format currency
const formatMoney = (amount: number) => {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: getDetectedCurrency(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Payment methods
const ALL_PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "mpesa", label: "M-PESA", icon: Smartphone },
  { id: "card", label: "Card", icon: CreditCard },
];
const PAYMENT_METHODS = ALL_PAYMENT_METHODS.filter((m) =>
  m.id === "mpesa" ? isKenyaStation() : true,
);

// Module-scoped subcomponents (UPDATE-4 rule)
const ProductCard = ({
  product,
  onAddToCart,
}: {
  product: any;
  onAddToCart: (product: any) => void;
}) => (
  <button
    onClick={() => onAddToCart(product)}
    className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all text-left"
  >
    <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-3">
      <span className="text-amber-400 font-bold text-lg">
        {product.name?.charAt(0) || "P"}
      </span>
    </div>
    <h4 className="text-white font-medium text-sm mb-1 truncate">
      {product.name}
    </h4>
    <p className="text-gray-400 text-xs mb-2">{product.sku}</p>
    <p className="text-amber-400 font-semibold">
      {formatMoney(product.selling_price)}
    </p>
    {product.stock_quantity <= product.reorder_level && (
      <span className="text-xs text-red-400 mt-1 block">
        Low stock: {product.stock_quantity}
      </span>
    )}
  </button>
);

const CartItem = ({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: POSItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) => (
  <div className="flex items-center gap-3 py-3 border-b border-white/5">
    <div className="flex-1">
      <p className="text-white text-sm font-medium">{item.name}</p>
      <p className="text-gray-400 text-xs">
        {formatMoney(item.unitPrice)} each
      </p>
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onDecrease}
        className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <Minus size={14} className="text-white" />
      </button>
      <span className="text-white font-medium w-8 text-center">
        {item.quantity}
      </span>
      <button
        onClick={onIncrease}
        className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <Plus size={14} className="text-white" />
      </button>
    </div>
    <div className="text-right min-w-[80px]">
      <p className="text-white font-medium">{formatMoney(item.totalAmount)}</p>
      {item.discountPercent > 0 && (
        <p className="text-emerald-400 text-xs">-{item.discountPercent}%</p>
      )}
    </div>
    <button
      onClick={onRemove}
      className="w-8 h-8 text-red-400 hover:text-red-300 transition-colors"
    >
      <Trash2 size={16} />
    </button>
  </div>
);

const CustomerSelector = ({
  customers,
  selectedCustomer,
  onSelect,
}: {
  customers: any[];
  selectedCustomer: any;
  onSelect: (customer: any) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search),
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left"
      >
        {selectedCustomer ? (
          <div className="flex items-center gap-3">
            <User size={18} className="text-gray-400" />
            <div>
              <p className="text-white text-sm">{selectedCustomer.name}</p>
              <p className="text-gray-400 text-xs">{selectedCustomer.phone}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <User size={18} className="text-gray-400" />
            <span className="text-gray-400 text-sm">Walk-in Customer</span>
          </div>
        )}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-gray-400 hover:bg-white/5 text-sm"
            >
              Walk-in Customer
            </button>
            {filtered.map((customer) => (
              <button
                key={customer.id}
                onClick={() => {
                  onSelect(customer);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-white/5"
              >
                <p className="text-white text-sm">{customer.name}</p>
                <p className="text-gray-400 text-xs">{customer.phone}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const CheckoutModal = ({
  cart,
  selectedCustomer,
  session,
  onClose,
  onComplete,
  onStartSession,
}: {
  cart: POSCart;
  selectedCustomer: any;
  session: any;
  onClose: () => void;
  onComplete: (method: string, reference: string) => void;
  onStartSession: () => void;
}) => {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [processing, setProcessing] = useState(false);

  if (!session) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-white/10">
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              No Active Session
            </h3>
            <p className="text-gray-400 mb-6">
              You need to open a terminal session before processing sales.
            </p>
            <button
              onClick={onStartSession}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors"
            >
              Open Session
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 mt-3 text-gray-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-lg w-full border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Complete Sale</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Order Summary */}
        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Items</span>
            <span className="text-white">{cart.items.length}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Subtotal</span>
            <span className="text-white">{formatMoney(cart.subtotal)}</span>
          </div>
          {cart.discountAmount > 0 && (
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Discount</span>
              <span className="text-emerald-400">
                -{formatMoney(cart.discountAmount)}
              </span>
            </div>
          )}
          <div className="flex justify-between mb-2">
            <span className="text-gray-400">Tax</span>
            <span className="text-white">{formatMoney(cart.taxAmount)}</span>
          </div>
          <div className="border-t border-white/10 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="text-white font-semibold">Total</span>
              <span className="text-amber-400 font-bold text-xl">
                {formatMoney(cart.totalAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Customer */}
        {selectedCustomer && (
          <div className="mb-4">
            <p className="text-gray-400 text-xs mb-1">Customer</p>
            <p className="text-white">{selectedCustomer.name}</p>
          </div>
        )}

        {/* Payment Method */}
        <div className="mb-6">
          <p className="text-gray-400 text-xs mb-3">Payment Method</p>
          <div className="grid grid-cols-3 gap-3">
            {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPaymentMethod(id)}
                className={`flex flex-col items-center gap-2 py-4 rounded-xl border transition-all ${
                  paymentMethod === id
                    ? "bg-amber-500/20 border-amber-500 text-amber-400"
                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"
                }`}
              >
                <Icon size={24} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Reference (for M-PESA) */}
        {paymentMethod === "mpesa" && (
          <div className="mb-6">
            <label className="text-gray-400 text-xs mb-2 block">
              Payment Reference (Phone Number)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Enter phone number"
              className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white"
            />
          </div>
        )}

        {/* Actions */}
        <button
          onClick={() => onComplete(paymentMethod, reference)}
          disabled={processing}
          className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CheckCircle size={20} />
              Complete Sale - {formatMoney(cart.totalAmount)}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const SuccessScreen = ({
  invoiceNumber,
  amount,
  onClose,
}: {
  invoiceNumber: string;
  amount: number;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-white/10 text-center">
      <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-emerald-400" />
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">Sale Complete!</h3>
      <p className="text-gray-400 mb-6">Transaction processed successfully.</p>
      <div className="bg-white/5 rounded-xl p-4 mb-6">
        <p className="text-gray-400 text-sm mb-1">Invoice Number</p>
        <p className="text-amber-400 font-mono text-lg">{invoiceNumber}</p>
        <p className="text-gray-400 text-sm mb-1 mt-4">Amount</p>
        <p className="text-white font-bold text-2xl">{formatMoney(amount)}</p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => window.print()}
          className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
        >
          <Receipt size={20} className="mx-auto" />
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors"
        >
          New Sale
        </button>
      </div>
    </div>
  </div>
);

// Main Component
export default function AdvancedPOS() {
  const { currentStation } = useStations();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [cart, setCart] = useState<POSCart>({
    items: [],
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
  });
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSale, setLastSale] = useState<{
    invoiceNumber: string;
    amount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!currentStation?.id) return;

    setLoading(true);
    try {
      const [productsData, customersData, sessions] = await Promise.all([
        fetchProducts(currentStation.id),
        fetchCustomers(currentStation.id),
        fetchOpenSessions(currentStation.id),
      ]);

      setProducts(productsData);
      setCustomers(customersData);
      setActiveSession(sessions[0] || null);
    } catch (error) {
      console.error("Failed to load POS data:", error);
    } finally {
      setLoading(false);
    }
  }, [currentStation?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search),
  );

  const addToCart = (product: any) => {
    const existingIndex = cart.items.findIndex(
      (item) => item.productId === product.id,
    );

    let newItems: POSItem[];

    if (existingIndex >= 0) {
      newItems = cart.items.map((item, index) => {
        if (index === existingIndex) {
          const newQty = item.quantity + 1;
          const baseAmount = newQty * item.unitPrice;
          const discount = baseAmount * (item.discountPercent / 100);
          const afterDiscount = baseAmount - discount;
          const tax = afterDiscount * (item.taxRate / 100);

          return {
            ...item,
            quantity: newQty,
            totalAmount: Math.round((afterDiscount + tax) * 100) / 100,
          };
        }
        return item;
      });
    } else {
      const taxRate = product.tax_rate || 16;
      const unitPrice = product.selling_price || 0;
      const baseAmount = unitPrice;
      const tax = baseAmount * (taxRate / 100);

      newItems = [
        ...cart.items,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice,
          discountPercent: 0,
          taxRate,
          taxAmount: Math.round(tax * 100) / 100,
          totalAmount: Math.round((baseAmount + tax) * 100) / 100,
        },
      ];
    }

    setCart(calculateCartTotals(newItems));
  };

  const updateQuantity = (index: number, delta: number) => {
    const newItems = cart.items.map((item, i) => {
      if (i !== index) return item;

      const newQty = Math.max(1, item.quantity + delta);
      const baseAmount = newQty * item.unitPrice;
      const discount = baseAmount * (item.discountPercent / 100);
      const afterDiscount = baseAmount - discount;
      const tax = afterDiscount * (item.taxRate / 100);

      return {
        ...item,
        quantity: newQty,
        totalAmount: Math.round((afterDiscount + tax) * 100) / 100,
      };
    });

    setCart(calculateCartTotals(newItems));
  };

  const removeFromCart = (index: number) => {
    const newItems = cart.items.filter((_, i) => i !== index);
    setCart(calculateCartTotals(newItems));
  };

  const clearCart = () => {
    setCart({
      items: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
    });
    setSelectedCustomer(null);
  };

  const handleCheckout = async (paymentMethod: string, reference: string) => {
    if (!currentStation?.id || cart.items.length === 0) return;

    try {
      const result = await processPOSCheckout(
        currentStation.id,
        cart,
        paymentMethod,
        reference || null,
        selectedCustomer?.id || null,
        activeSession?.id || null,
      );

      if (result.success) {
        setLastSale({
          invoiceNumber: result.invoiceNumber || "",
          amount: cart.totalAmount,
        });
        setShowCheckout(false);
        setShowSuccess(true);
        clearCart();
        await loadData();
      } else {
        alert(result.error || "Checkout failed");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("An error occurred during checkout");
    }
  };

  const handleStartSession = async () => {
    if (!currentStation?.id) return;

    try {
      const result = await openTerminalSession(currentStation.id);
      if (result.success && result.sessionId) {
        setActiveSession({
          id: result.sessionId,
          session_number: result.sessionNumber,
        });
        setShowCheckout(false);
      } else {
        alert(result.error || "Failed to open session");
      }
    } catch (error) {
      console.error("Session error:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading POS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Products Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Point of Sale</h1>
          {activeSession && (
            <p className="text-gray-400 text-sm">
              Session: {activeSession.session_number}
            </p>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search products by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white"
          />
        </div>

        {/* Customer Selector */}
        <div className="mb-6">
          <CustomerSelector
            customers={customers}
            selectedCustomer={selectedCustomer}
            onSelect={setSelectedCustomer}
          />
        </div>

        {/* Products */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={addToCart}
            />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No products found</p>
            <p className="text-gray-500 text-sm mt-1">
              Add products in the Products section
            </p>
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      <div className="w-96 bg-gray-800/50 backdrop-blur-xl border-l border-white/10 flex flex-col">
        {/* Cart Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="text-amber-400" size={24} />
              <h2 className="text-lg font-semibold text-white">Cart</h2>
            </div>
            {cart.items.length > 0 && (
              <button
                onClick={clearCart}
                className="text-gray-400 hover:text-red-400 text-sm"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Cart is empty</p>
              <p className="text-gray-500 text-sm">
                Add products to get started
              </p>
            </div>
          ) : (
            cart.items.map((item, index) => (
              <CartItem
                key={item.productId}
                item={item}
                onIncrease={() => updateQuantity(index, 1)}
                onDecrease={() => updateQuantity(index, -1)}
                onRemove={() => removeFromCart(index)}
              />
            ))
          )}
        </div>

        {/* Cart Summary */}
        {cart.items.length > 0 && (
          <div className="p-4 border-t border-white/10">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white">{formatMoney(cart.subtotal)}</span>
              </div>
              {cart.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Discount</span>
                  <span className="text-emerald-400">
                    -{formatMoney(cart.discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Tax</span>
                <span className="text-white">
                  {formatMoney(cart.taxAmount)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/10">
                <span className="text-white font-semibold">Total</span>
                <span className="text-amber-400 font-bold text-xl">
                  {formatMoney(cart.totalAmount)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowCheckout(true)}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard size={20} />
              Checkout
            </button>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <CheckoutModal
          cart={cart}
          selectedCustomer={selectedCustomer}
          session={activeSession}
          onClose={() => setShowCheckout(false)}
          onComplete={handleCheckout}
          onStartSession={handleStartSession}
        />
      )}

      {/* Success Screen */}
      {showSuccess && lastSale && (
        <SuccessScreen
          invoiceNumber={lastSale.invoiceNumber}
          amount={lastSale.amount}
          onClose={() => setShowSuccess(false)}
        />
      )}
    </div>
  );
}
