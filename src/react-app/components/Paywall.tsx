import { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  Check,
  Gift,
  User,
  Crown,
  Shield,
  Zap,
  Smartphone,
  CreditCard,
  Lock,
  AlertTriangle,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Calendar,
  HardDrive,
  Upload,
  ArrowRight,
} from "lucide-react";
import {
  TIERS,
  type SubscriptionTier,
  type SubscriptionState,
  getSubscription,
  activateTier,
  setSubscription,
  logSubscriptionAction,
} from "@/react-app/lib/subscriptionStore";

interface PaywallProps {
  onClose: () => void;
  currentTier?: string;
}

const TIER_ICONS: Record<string, typeof Gift> = {
  free: Gift,
  staff: User,
  manager: Crown,
  auditor: Shield,
};

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[\s+\-]/g, "");
  if (cleaned.startsWith("0")) cleaned = "254" + cleaned.slice(1);
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  return cleaned;
}

export default function Paywall({ onClose }: PaywallProps) {
  const [selectedTier, setSelectedTier] = useState<string>("staff");
  const [step, setStep] = useState<
    "tiers" | "payment" | "processing" | "success"
  >("tiers");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [sub, setSub] = useState<SubscriptionState>(getSubscription());
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSub(getSubscription());
  }, []);

  const handleSelectTier = useCallback((key: string) => {
    if (key === "free") {
      // Free tier - just activate
      activateTier("free");
      setSub(getSubscription());
      setStep("success");
      return;
    }
    setSelectedTier(key);
    setStep("payment");
  }, []);

  const handleMpesaPayment = useCallback(() => {
    setError("");
    if (!phone || !/^\+?\d{9,12}$/.test(phone.replace(/\s/g, ""))) {
      setError("Please enter a valid phone number");
      return;
    }
    if (!agreed) {
      setError("Please agree to the terms");
      return;
    }

    setStep("processing");

    // Simulate M-PESA STK Push
    setTimeout(() => {
      // In production, this would call the actual M-PESA API
      // For now, simulate a successful payment
      const normalizedPhone = formatPhone(phone);
      const tierData = TIERS.find(t => t.key === selectedTier);
      if (!tierData) return;

      const receipt = `MPESA${Date.now()}`;
      const newSub = activateTier(selectedTier, {
        mpesaReceipt: receipt,
        phone: normalizedPhone,
      });
      setSub(newSub);
      logSubscriptionAction(
        "activated",
        selectedTier,
        `M-PESA payment: ${receipt}`
      );
      setStep("success");
    }, 3000);
  }, [phone, agreed, selectedTier]);

  const currentTierData = TIERS.find(t => t.key === sub.tier);
  const selectedTierData = TIERS.find(t => t.key === selectedTier);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        style={{
          background: "#111827",
          borderRadius: 16,
          width: "100%",
          maxWidth: 820,
          maxHeight: "90vh",
          overflowY: "auto",
          border: "1px solid #1f2937",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          animation: "paywallIn 0.3s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #1f2937",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Lock size={20} style={{ color: "#f59e0b" }} /> Choose Your Plan
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>
              {sub.status === "trial"
                ? "Your trial is active. Upgrade anytime."
                : "Select a plan to unlock full features."}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              padding: 4,
              borderRadius: 8,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Steps */}
        {step === "tiers" && (
          <div style={{ padding: 24 }}>
            {/* Current tier badge */}
            {currentTierData && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 10,
                  borderRadius: 10,
                  background: `${currentTierData.color}15`,
                  border: `1px solid ${currentTierData.color}30`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {(() => {
                  const Icon = TIER_ICONS[currentTierData.key] || Gift;
                  return (
                    <Icon size={18} style={{ color: currentTierData.color }} />
                  );
                })()}
                <span style={{ fontSize: 13, color: "#e5e7eb" }}>
                  Current:{" "}
                  <strong style={{ color: currentTierData.color }}>
                    {currentTierData.name}
                  </strong>
                  {sub.status === "trial" && (
                    <span style={{ color: "#f59e0b", marginLeft: 8 }}>
                      (Trial)
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Tier cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 12,
              }}
            >
              {TIERS.map(tier => {
                const Icon = TIER_ICONS[tier.key] || Gift;
                const isCurrent = sub.tier === tier.key;
                return (
                  <button
                    key={tier.key}
                    onClick={() => setSelectedTier(tier.key)}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: "#0f1117",
                      border: `2px solid ${selectedTier === tier.key ? tier.color : "#1f2937"}`,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                    onMouseEnter={e => {
                      if (selectedTier !== tier.key)
                        e.currentTarget.style.borderColor = "#374151";
                    }}
                    onMouseLeave={e => {
                      if (selectedTier !== tier.key)
                        e.currentTarget.style.borderColor = "#1f2937";
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: `${tier.color}20`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon size={16} style={{ color: tier.color }} />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#fff",
                          }}
                        >
                          {tier.name}
                        </div>
                        {isCurrent && (
                          <span style={{ fontSize: 10, color: tier.color }}>
                            Current plan
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: tier.color,
                      }}
                    >
                      {tier.priceKES === 0
                        ? "Free"
                        : `Ksh ${tier.priceKES.toLocaleString()}`}
                      {tier.priceKES > 0 && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#6b7280",
                            fontWeight: 400,
                          }}
                        >
                          /mo
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                        lineHeight: 1.4,
                      }}
                    >
                      {tier.description}
                    </div>
                    <div
                      style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <Upload size={10} /> {tier.maxUploads} uploads
                      </span>
                      <span
                        style={{
                          marginLeft: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <HardDrive size={10} /> {tier.maxStorage}
                      </span>
                    </div>
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {tier.features.slice(0, 4).map((f, i) => (
                        <li
                          key={i}
                          style={{
                            fontSize: 10,
                            color: "#9ca3af",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 4,
                          }}
                        >
                          <Check
                            size={10}
                            style={{
                              color: tier.color,
                              marginTop: 2,
                              flexShrink: 0,
                            }}
                          />{" "}
                          {f}
                        </li>
                      ))}
                    </ul>
                    {selectedTier === tier.key && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: 6,
                          background: `${tier.color}15`,
                          borderRadius: 6,
                          textAlign: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          color: tier.color,
                        }}
                      >
                        Selected
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {selectedTier === "free" ? (
                <button
                  onClick={() => handleSelectTier("free")}
                  style={{
                    flex: 1,
                    padding: 12,
                    background: "#1f2937",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  Continue with Free Trial
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleSelectTier(selectedTier)}
                    style={{
                      flex: 1,
                      padding: 12,
                      background: "#f59e0b",
                      color: "#000",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Zap size={15} /> Pay with M-PESA <ArrowRight size={15} />
                  </button>
                  <button
                    onClick={() => setStep("payment")}
                    style={{
                      padding: 12,
                      background: "transparent",
                      color: "#6b7280",
                      border: "1px solid #374151",
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <CreditCard size={15} /> Card
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Payment step */}
        {step === "payment" && selectedTierData && (
          <div style={{ padding: 24 }}>
            <button
              onClick={() => setStep("tiers")}
              style={{
                background: "none",
                border: "none",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: 12,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <ArrowRight size={12} style={{ transform: "rotate(180deg)" }} />{" "}
              Back to plans
            </button>

            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: "#0f1117",
                border: `1px solid ${selectedTierData.color}30`,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  marginBottom: 4,
                }}
              >
                {selectedTierData.name}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 800,
                  color: selectedTierData.color,
                }}
              >
                Ksh {selectedTierData.priceKES.toLocaleString()}
                <span style={{ fontSize: 12, color: "#6b7280" }}>/month</span>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                ${selectedTierData.priceUSD}/month USD equivalent
              </div>
            </div>

            {/* M-PESA form */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#e5e7eb",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                <Smartphone
                  size={12}
                  style={{ display: "inline", marginRight: 4 }}
                />{" "}
                M-PESA Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => {
                  setPhone(e.target.value);
                  setError("");
                }}
                placeholder="07XX XXX XXX or 2547XXXXXXXX"
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "#0f1117",
                  border: `1px solid ${error ? "#ef4444" : "#374151"}`,
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "#4b5563",
                  marginTop: 4,
                  display: "block",
                }}
              >
                Format: 0712345678 or 254712345678
              </span>
            </div>

            {/* Agreement */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 16,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => {
                  setAgreed(e.target.checked);
                  setError("");
                }}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>
                I agree to the{" "}
                <a href="#/terms" style={{ color: "#f59e0b" }}>
                  Terms of Service
                </a>{" "}
                and authorize Ksh {selectedTierData.priceKES.toLocaleString()}{" "}
                charge via M-PESA
              </span>
            </label>

            {error && (
              <div
                style={{
                  padding: 10,
                  background: "rgba(239,68,68,0.1)",
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 12,
                  color: "#f87171",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <AlertTriangle size={14} /> {error}
              </div>
            )}

            <button
              onClick={handleMpesaPayment}
              disabled={!phone || !agreed}
              style={{
                width: "100%",
                padding: 14,
                background: !phone || !agreed ? "#374151" : "#48bb78",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: !phone || !agreed ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Zap size={18} /> Pay Ksh{" "}
              {selectedTierData.priceKES.toLocaleString()} via M-PESA
            </button>

            <p
              style={{
                fontSize: 10,
                color: "#4b5563",
                textAlign: "center",
                marginTop: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <Lock size={10} /> Secured by Safaricom M-PESA. Kenya Data
              Protection Act 2019 compliant.
            </p>
          </div>
        )}

        {/* Processing */}
        {step === "processing" && (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ animation: "pulse 1.5s infinite", marginBottom: 16 }}>
              <Smartphone size={48} style={{ color: "#f59e0b" }} />
            </div>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                margin: "0 0 8px",
              }}
            >
              M-PESA Prompt Sent
            </h3>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 16px" }}>
              Check your phone and enter your M-PESA PIN
            </p>
            <div
              style={{
                width: "100%",
                maxWidth: 200,
                height: 6,
                background: "#1f2937",
                borderRadius: 3,
                overflow: "hidden",
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "#f59e0b",
                  borderRadius: 3,
                  animation: "progressBar 3s ease-in-out forwards",
                  width: "100%",
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: "#4b5563", marginTop: 12 }}>
              Waiting for confirmation...
            </p>
          </div>
        )}

        {/* Success */}
        {step === "success" && selectedTierData && (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                background: "#10b98120",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircle2 size={32} style={{ color: "#10b981" }} />
            </div>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                margin: "0 0 8px",
              }}
            >
              {selectedTierData.key === "free"
                ? "Trial Activated!"
                : "Payment Successful!"}
            </h3>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 16px" }}>
              {selectedTierData.key === "free"
                ? "Your 7-day free trial is now active. Enjoy full access!"
                : `Welcome to ${selectedTierData.name}! Your subscription is active.`}
            </p>
            {sub.mpesaReceipt && (
              <div
                style={{
                  padding: 10,
                  background: "#0f1117",
                  borderRadius: 8,
                  marginBottom: 16,
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                Receipt:{" "}
                <span style={{ color: "#e5e7eb", fontWeight: 600 }}>
                  {sub.mpesaReceipt}
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 24px",
                  background: "#f59e0b",
                  color: "#000",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Get Started
              </button>
            </div>
          </div>
        )}

        {/* Compliance footer */}
        {step === "tiers" && (
          <div
            style={{
              padding: "12px 24px",
              borderTop: "1px solid #1f2937",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 10,
                color: "#4b5563",
                margin: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <Calendar size={10} /> Cancel anytime. No hidden fees. VAT
              inclusive where applicable.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes paywallIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes progressBar { from { width: 0%; } to { width: 100%; } }
      `}</style>
    </div>
  );
}
