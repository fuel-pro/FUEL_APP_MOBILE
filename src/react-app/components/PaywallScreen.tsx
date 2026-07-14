import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/react-app/context/AuthContext";
import {
  CreditCard,
  Clock,
  Check,
  Shield,
  Star,
  Key,
  Smartphone,
  ArrowLeft,
  Fuel,
  Zap,
  Globe,
  Tag,
  AlertTriangle,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Timer,
  Lock,
  Gift,
} from "lucide-react";
import {
  checkTrialStatus,
  startTrial,
  checkTrialAbuse,
  recordTrialAbuse,
  createSubscription,
  recordPayment,
  applyCoupon,
  useCoupon,
  resolvePrice,
  resolveCountry,
  getAvailableGateways,
  loadTiers,
  loadRegionalPrices,
  type TierSlug,
  type GatewayInfo,
} from "@/react-app/lib/subscription";

interface PaywallScreenProps {
  onSubscriptionActive: () => void;
}

export default function PaywallScreen({
  onSubscriptionActive,
}: PaywallScreenProps) {
  const { user, logout } = useAuth();
  const [selectedTier, setSelectedTier] = useState<TierSlug>("monthly");
  const [isProcessing, setIsProcessing] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<{
    valid: boolean;
    discount: number;
    message: string;
  } | null>(null);
  const [selectedGateway, setSelectedGateway] = useState("");
  const [step, setStep] = useState<"trial" | "plans" | "checkout" | "success">(
    "trial"
  );
  const [trialStatus, setTrialStatus] = useState(checkTrialStatus());
  const [trialMinutes, setTrialMinutes] = useState(60);
  const [trialSeconds, setTrialSeconds] = useState(0);

  // Load customizable paywall content
  const [pwContent] = useState(() => {
    try {
      const s = localStorage.getItem("fuelpro_paywall_content");
      if (s) return JSON.parse(s);
    } catch {
      /* */
    }
    return null;
  });
  const pwc = (key: string, fallback: string) => pwContent?.[key] || fallback;
  const pwcN = (key: string, fallback: number) => pwContent?.[key] ?? fallback;
  const pwcB = (key: string, fallback: boolean) => pwContent?.[key] ?? fallback;
  const [trialStarted, setTrialStarted] = useState(false);

  const country = resolveCountry();
  const tiers = loadTiers().filter(t => t.isActive);
  const prices = loadRegionalPrices();

  // Countdown timer
  useEffect(() => {
    if (!trialStatus.active) return;
    const interval = setInterval(() => {
      const ts = checkTrialStatus();
      setTrialStatus(ts);
      if (ts.active) {
        const totalSec = Math.floor(ts.remainingMs / 1000);
        setTrialMinutes(Math.floor(totalSec / 60));
        setTrialSeconds(totalSec % 60);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [trialStatus.active]);

  const getTierPrice = (tierId: TierSlug) => {
    const rp = resolvePrice(tierId, country.code);
    if (!rp)
      return {
        amount: 0,
        currency: country.currency,
        gateways: [] as GatewayInfo[],
      };
    const gateways = getAvailableGateways(rp.currency);
    return { amount: rp.price, currency: rp.currency, gateways };
  };

  const currentPrice = getTierPrice(selectedTier);
  const discountedPrice = useMemo(() => {
    if (!couponResult?.valid) return currentPrice.amount;
    if (couponResult.discount < 100) {
      return Math.round(
        currentPrice.amount * (1 - couponResult.discount / 100)
      );
    }
    return Math.max(0, currentPrice.amount - couponResult.discount);
  }, [couponResult, currentPrice.amount]);

  // Auto-select first gateway
  useEffect(() => {
    if (currentPrice.gateways.length > 0 && !selectedGateway) {
      setSelectedGateway(currentPrice.gateways[0].id);
    }
  }, [currentPrice.gateways, selectedGateway]);

  const handleStartTrial = () => {
    if (!user) return;
    const email = user.email || "anonymous@fuelpro.app";

    // Check abuse
    if (checkTrialAbuse(email)) {
      setStep("plans");
      return;
    }

    startTrial(user.id || email, email);
    recordTrialAbuse(email);
    setTrialStarted(true);
    setTrialStatus(checkTrialStatus());
    setStep("trial");
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    const result = applyCoupon(couponCode, selectedTier, country.code);
    setCouponResult(result);
    if (result.valid) {
      useCoupon(couponCode);
    }
  };

  const handlePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const sub = createSubscription(
        user?.id || "anonymous",
        selectedTier,
        currentPrice.currency,
        discountedPrice,
        selectedGateway || "mpesa",
        couponResult?.valid ? couponCode : undefined
      );
      recordPayment(
        sub.id,
        selectedGateway || "mpesa",
        discountedPrice,
        currentPrice.currency
      );
      setIsProcessing(false);
      setStep("success");
      setTimeout(() => onSubscriptionActive(), 2000);
    }, 2000);
  };

  const handleUnlockWithCode = () => {
    if (!secretCode.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      const sub = createSubscription(
        user?.id || "anonymous",
        "lifetime",
        currentPrice.currency,
        0,
        "access-code",
        undefined
      );
      recordPayment(sub.id, "access-code", 0, currentPrice.currency);
      setIsProcessing(false);
      setStep("success");
      setTimeout(() => onSubscriptionActive(), 2000);
    }, 1500);
  };

  const selectedTierObj = tiers.find(t => t.id === selectedTier);

  // ─── TRIAL STEP ───
  if (step === "trial") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 p-4 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <button
            onClick={() => logout()}
            className="mb-4 text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Login
          </button>

          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
              <Fuel size={32} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white font-serif mb-2">
              {pwc("title", "FuelPro")}
            </h1>
            <p className="text-gray-400 mb-6">
              {pwc("subtitle", "Professional Fuel Management System")}
            </p>

            {trialStatus.active || trialStarted ? (
              <>
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6 mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <CheckCircle2 size={18} className="text-green-400" />
                    <span className="text-green-400 font-medium">
                      Trial Active
                    </span>
                  </div>
                  <div className="text-5xl font-bold text-white font-mono mb-1">
                    {String(trialMinutes).padStart(2, "0")}:
                    {String(trialSeconds).padStart(2, "0")}
                  </div>
                  <p className="text-sm text-gray-500">
                    remaining in your free trial
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[
                    { icon: Fuel, label: "Full Access" },
                    { icon: CreditCard, label: "All Features" },
                    { icon: Shield, label: "Secure" },
                  ].map(f => (
                    <div key={f.label} className="bg-white/5 rounded-lg p-3">
                      <f.icon
                        size={18}
                        className="mx-auto mb-1 text-amber-400"
                      />
                      <p className="text-[10px] text-gray-400">{f.label}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => onSubscriptionActive()}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20"
                >
                  Continue to Dashboard
                </button>
                <button
                  onClick={() => setStep("plans")}
                  className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Upgrade to Pro
                </button>
              </>
            ) : (
              <>
                <div
                  className="rounded-xl p-6 mb-6"
                  style={{
                    backgroundColor: pwc("accentColor", "#d97706") + "10",
                    border: `1px solid ${pwc("accentColor", "#d97706")}30`,
                  }}
                >
                  <Timer
                    size={32}
                    className="mx-auto mb-3"
                    style={{ color: pwc("accentColor", "#d97706") }}
                  />
                  <h3 className="text-xl font-bold text-white mb-1">
                    {pwc("trialHeadline", "Free Trial")}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {pwc(
                      "trialDescription",
                      "Experience the full power of FuelPro before you subscribe"
                    )}
                  </p>
                </div>

                <div className="space-y-3 mb-6 text-left">
                  {(
                    pwContent?.features || [
                      "Complete fuel management",
                      "Real-time sales tracking",
                      "M-PESA integration",
                      "Invoice & receipt generation",
                      "Team management",
                    ]
                  ).map((f: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-sm text-gray-300"
                    >
                      <Check
                        size={16}
                        className="text-green-400 flex-shrink-0"
                      />{" "}
                      {f}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleStartTrial}
                  className="w-full py-3 text-white font-semibold rounded-xl transition-all shadow-lg mb-3"
                  style={{
                    background: `linear-gradient(to right, ${pwc("accentColor", "#d97706")}, ${pwc("accentColor", "#d97706")})`,
                  }}
                >
                  {pwc("ctaText", "Start Free Trial")}
                </button>
                <button
                  onClick={() => setStep("plans")}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {pwc("skipTrialText", "Skip Trial, View Plans")}
                </button>

                {pwcB("showTrustBadges", true) && (
                  <div className="flex items-center justify-center gap-1 mt-4 text-[10px] text-gray-600">
                    <Shield size={10} />{" "}
                    {pwc(
                      "footerNote",
                      "No credit card required. One trial per device."
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── PLANS STEP ───
  if (step === "plans") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 p-4">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => logout()}
            className="mb-4 text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Login
          </button>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
              <Fuel size={24} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white font-serif">
              Choose Your Plan
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2 text-sm text-gray-400">
              <Globe size={14} /> {country.name} — {country.currency}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3 mb-8">
            {tiers.map(tier => {
              const tp = getTierPrice(tier.id);
              const isSelected = selectedTier === tier.id;
              return (
                <button
                  key={tier.id}
                  onClick={() => {
                    setSelectedTier(tier.id);
                    setCouponResult(null);
                    setCouponCode("");
                  }}
                  className={`relative bg-white/[0.03] border rounded-2xl p-5 text-left transition-all ${
                    isSelected
                      ? "border-amber-500/50 shadow-lg shadow-amber-500/10"
                      : "border-white/[0.06] hover:border-white/[0.12]"
                  }`}
                >
                  {tier.recommended && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 bg-amber-500 text-white rounded-full font-medium">
                      Best Value
                    </span>
                  )}
                  <h3 className="text-sm font-semibold text-white mb-1">
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-2xl font-bold text-white">
                      {tp.currency === "USD" ? "$" : tp.currency}
                    </span>
                    <span className="text-3xl font-bold text-amber-400">
                      {tp.amount.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-3">
                    {tier.durationDays === -1
                      ? "One-time payment"
                      : `Per ${tier.durationDays === 1 ? "day" : tier.durationDays === 7 ? "week" : tier.durationDays === 30 ? "month" : "year"}`}
                  </p>
                  <div className="space-y-1.5">
                    {tier.features.slice(0, 4).map(f => (
                      <div
                        key={f}
                        className="flex items-center gap-2 text-[11px] text-gray-400"
                      >
                        <Check
                          size={12}
                          className="text-green-400 flex-shrink-0"
                        />{" "}
                        {f}
                      </div>
                    ))}
                  </div>
                  {isSelected && (
                    <div className="mt-3 text-center text-[10px] text-amber-400 font-medium">
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Coupon */}
          {pwcB("enableCoupons", true) && (
            <div className="max-w-md mx-auto mb-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
                  />
                  <input
                    value={couponCode}
                    onChange={e => {
                      setCouponCode(e.target.value);
                      setCouponResult(null);
                    }}
                    onKeyDown={e => e.key === "Enter" && handleApplyCoupon()}
                    placeholder="Enter coupon code"
                    className="w-full pl-9 pr-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/30"
                  />
                </div>
                <button
                  onClick={handleApplyCoupon}
                  disabled={!couponCode.trim()}
                  className="px-4 py-2.5 bg-purple-500/15 hover:bg-purple-500/25 disabled:bg-white/5 text-purple-300 disabled:text-gray-600 text-sm rounded-xl border border-purple-500/20 disabled:border-white/10 transition-colors"
                >
                  Apply
                </button>
              </div>
              {couponResult && (
                <div
                  className={`mt-2 text-xs flex items-center gap-1 ${couponResult.valid ? "text-emerald-400" : "text-red-400"}`}
                >
                  {couponResult.valid ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <AlertTriangle size={12} />
                  )}
                  {couponResult.message}
                </div>
              )}
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => setStep("checkout")}
              className="px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 mx-auto"
            >
              Continue <ChevronRight size={18} />
            </button>
            {trialStatus.active && (
              <button
                onClick={() => onSubscriptionActive()}
                className="mt-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Continue with trial
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── CHECKOUT STEP ───
  if (step === "checkout") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 p-4 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <button
            onClick={() => setStep("plans")}
            className="mb-4 text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Plans
          </button>

          <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-1">Checkout</h2>
            <p className="text-sm text-gray-500 mb-6">
              {country.name} — {country.currency}
            </p>

            {/* Order Summary */}
            <div className="bg-white/[0.02] rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">
                  {selectedTierObj?.name} Plan
                </span>
                <span className="text-white">
                  {currentPrice.currency} {currentPrice.amount.toLocaleString()}
                </span>
              </div>
              {couponResult?.valid && (
                <div className="flex justify-between text-sm">
                  <span className="text-purple-400 flex items-center gap-1">
                    <Tag size={12} /> Coupon
                  </span>
                  <span className="text-purple-400">
                    -{couponResult.discount}
                    {couponResult.discount > 100 ? "" : "%"}
                  </span>
                </div>
              )}
              <div className="border-t border-white/[0.06] pt-2 flex justify-between">
                <span className="text-white font-medium">Total</span>
                <span className="text-amber-400 font-bold text-lg">
                  {currentPrice.currency} {discountedPrice.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Gateway Selection */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 mb-2 block">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {currentPrice.gateways.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGateway(g.id)}
                    className={`p-3 rounded-xl border transition-all text-left ${
                      selectedGateway === g.id
                        ? "border-amber-500/50 bg-amber-500/5"
                        : "border-white/[0.06] hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap
                        size={14}
                        className={
                          selectedGateway === g.id
                            ? "text-amber-400"
                            : "text-gray-500"
                        }
                      />
                      <span className="text-sm text-white">{g.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {g.methods.slice(0, 2).map(m => (
                        <span
                          key={m}
                          className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-gray-500"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Activation Code Option */}
            {pwcB("enableAccessCode", true) && (
              <div className="mb-6">
                <label className="text-xs text-gray-400 mb-2 block">
                  Or enter access code
                </label>
                <div className="relative">
                  <Key
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
                  />
                  <input
                    type="password"
                    value={secretCode}
                    onChange={e => setSecretCode(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleUnlockWithCode()}
                    placeholder="Enter activation code"
                    className="w-full pl-9 pr-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/30"
                  />
                </div>
              </div>
            )}

            <button
              onClick={
                pwcB("enableAccessCode", true) && secretCode.trim()
                  ? handleUnlockWithCode
                  : handlePayment
              }
              disabled={
                isProcessing ||
                ((pwcB("enableAccessCode", true) ? !secretCode.trim() : true) &&
                  !selectedGateway)
              }
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Processing...
                </>
              ) : pwcB("enableAccessCode", true) && secretCode.trim() ? (
                <>
                  <Key size={18} /> Unlock with Code
                </>
              ) : (
                <>
                  <CreditCard size={18} /> Pay {currentPrice.currency}{" "}
                  {discountedPrice.toLocaleString()}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── SUCCESS STEP ───
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-900 to-slate-950 p-4 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
          <Check size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          Payment Successful!
        </h1>
        <p className="text-gray-400 mb-8">
          Your FuelPro {selectedTierObj?.name} plan is now active.
        </p>
        <div className="animate-pulse text-sm text-amber-400">
          Redirecting to dashboard...
        </div>
      </div>
    </div>
  );
}
