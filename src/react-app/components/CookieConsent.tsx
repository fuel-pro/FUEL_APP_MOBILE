import { useState, useEffect } from "react";
import { Cookie, X } from "lucide-react";

interface CookieConsentProps {
  onAccept?: () => void;
  onDecline?: () => void;
}

export default function CookieConsent({
  onAccept,
  onDecline,
}: CookieConsentProps) {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("fuelpro_cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(
      "fuelpro_cookie_consent",
      JSON.stringify({
        necessary: true,
        analytics: true,
        marketing: false,
        timestamp: Date.now(),
      })
    );
    setVisible(false);
    onAccept?.();
  };

  const handleDecline = () => {
    localStorage.setItem(
      "fuelpro_cookie_consent",
      JSON.stringify({
        necessary: true,
        analytics: false,
        marketing: false,
        timestamp: Date.now(),
      })
    );
    setVisible(false);
    onDecline?.();
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        padding: "20px",
        boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "rgba(245,158,11,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Cookie size={24} style={{ color: "#f59e0b" }} />
        </div>

        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#fff",
              margin: "0 0 8px 0",
            }}
          >
            🍪 We value your privacy
          </h3>

          {!showDetails ? (
            <p
              style={{
                fontSize: 13,
                color: "#9ca3af",
                margin: "0 0 16px 0",
                lineHeight: 1.5,
              }}
            >
              We use cookies to enhance your browsing experience, serve
              personalized content, and analyze our traffic. By clicking "Accept
              All", you consent to our use of cookies.{" "}
              <button
                onClick={() => setShowDetails(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#f59e0b",
                  cursor: "pointer",
                  fontSize: 13,
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Learn more
              </button>
            </p>
          ) : (
            <div
              style={{
                background: "rgba(0,0,0,0.2)",
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <h4 style={{ fontSize: 14, color: "#fff", margin: "0 0 12px 0" }}>
                Cookie Types
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "#fff" }}>
                      Necessary Cookies
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      Required for app functionality
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#10b981",
                      background: "rgba(16,185,129,0.2)",
                      padding: "2px 8px",
                      borderRadius: 4,
                    }}
                  >
                    Always Active
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "#fff" }}>
                      Analytics Cookies
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      Help us improve the app
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#60a5fa",
                      background: "rgba(59,130,246,0.2)",
                      padding: "2px 8px",
                      borderRadius: 4,
                    }}
                  >
                    Optional
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "#fff" }}>
                      Marketing Cookies
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      Used for advertising
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#60a5fa",
                      background: "rgba(59,130,246,0.2)",
                      padding: "2px 8px",
                      borderRadius: 4,
                    }}
                  >
                    Optional
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                style={{
                  marginTop: 12,
                  background: "none",
                  border: "none",
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontSize: 12,
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Show less
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={handleAccept}
              aria-label="Accept all cookies"
              style={{
                padding: "10px 20px",
                background: "#f59e0b",
                color: "#000",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={e => (e.currentTarget.style.background = "#d97706")}
              onMouseOut={e => (e.currentTarget.style.background = "#f59e0b")}
            >
              Accept All
            </button>
            <button
              onClick={handleDecline}
              aria-label="Decline optional cookies"
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "#9ca3af",
                border: "1px solid #4b5563",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = "#6b7280";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = "#4b5563";
                e.currentTarget.style.color = "#9ca3af";
              }}
            >
              Decline Optional
            </button>
            <a
              href="#/privacy"
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: "#9ca3af",
                border: "none",
                fontSize: 13,
                textDecoration: "underline",
                cursor: "pointer",
                alignSelf: "center",
              }}
            >
              Privacy Policy
            </a>
          </div>
        </div>

        <button
          onClick={handleDecline}
          aria-label="Close cookie banner"
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: "50%",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <X size={16} style={{ color: "#9ca3af" }} />
        </button>
      </div>
    </div>
  );
}

// Hook to check cookie consent status
export function useCookieConsent() {
  const getConsent = () => {
    try {
      const consent = localStorage.getItem("fuelpro_cookie_consent");
      if (consent) return JSON.parse(consent);
    } catch {}
    return null;
  };

  const hasAnalyticsConsent = () => {
    const consent = getConsent();
    return consent?.analytics === true;
  };

  const hasMarketingConsent = () => {
    const consent = getConsent();
    return consent?.marketing === true;
  };

  return { getConsent, hasAnalyticsConsent, hasMarketingConsent };
}
