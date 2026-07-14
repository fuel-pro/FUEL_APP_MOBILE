import { useState } from "react";
import { Home, RefreshCw, Mail, AlertTriangle } from "lucide-react";

interface ErrorPageProps {
  code: number;
  title: string;
  message: string;
}

export default function ErrorPage({ code, title, message }: ErrorPageProps) {
  const [isReloading, setIsReloading] = useState(false);

  const handleReload = () => {
    setIsReloading(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleGoHome = () => {
    window.location.hash = "";
    window.location.reload();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 500,
          textAlign: "center",
          animation: "fadeIn 0.5s ease-out",
        }}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        `}</style>

        {/* Error Code */}
        <div
          style={{
            fontSize: 120,
            fontWeight: "bold",
            background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 16,
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          {code}
        </div>

        {/* Warning Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(245,158,11,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            animation: "float 3s ease-in-out infinite",
          }}
        >
          <AlertTriangle size={40} style={{ color: "#f59e0b" }} />
        </div>

        {/* Title & Message */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: "bold",
            color: "#fff",
            marginBottom: 12,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#9ca3af",
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          {message}
        </p>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={handleGoHome}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              background: "#f59e0b",
              color: "#000",
              border: "none",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseOver={e =>
              (e.currentTarget.style.transform = "translateY(-2px)")
            }
            onMouseOut={e =>
              (e.currentTarget.style.transform = "translateY(0)")
            }
          >
            <Home size={18} /> Go Home
          </button>

          <button
            onClick={handleReload}
            disabled={isReloading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              background: "transparent",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 500,
              cursor: isReloading ? "wait" : "pointer",
              transition: "all 0.2s",
              opacity: isReloading ? 0.7 : 1,
            }}
          >
            <RefreshCw
              size={18}
              className={isReloading ? "spin" : ""}
              style={{
                animation: isReloading ? "spin 1s linear infinite" : "none",
              }}
            />
            {isReloading ? "Reloading..." : "Try Again"}
          </button>
        </div>

        {/* Contact Support */}
        <div
          style={{
            marginTop: 48,
            padding: 20,
            background: "rgba(255,255,255,0.03)",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 12 }}>
            If this problem persists, please contact support:
          </p>
          <a
            href="mailto:support@fuelpro.app"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "#f59e0b",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            <Mail size={16} /> support@fuelpro.app
          </a>
        </div>

        {/* Quick Links */}
        <div
          style={{
            marginTop: 32,
            display: "flex",
            justifyContent: "center",
            gap: 24,
          }}
        >
          <a
            href="#/"
            style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}
          >
            Home
          </a>
          <a
            href="#/privacy"
            style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}
          >
            Privacy
          </a>
          <a
            href="#/terms"
            style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}
          >
            Terms
          </a>
        </div>

        {/* Error ID for debugging */}
        <p
          style={{
            marginTop: 32,
            fontSize: 11,
            color: "#4b5563",
          }}
        >
          Error ID: {code}-{Date.now().toString(36).toUpperCase()}
        </p>
      </div>
    </div>
  );
}

// Pre-configured error pages
export function NotFoundPage() {
  return (
    <ErrorPage
      code={404}
      title="Page Not Found"
      message="The page you're looking for doesn't exist or has been moved. Check the URL or navigate back to the homepage."
    />
  );
}

export function ServerErrorPage() {
  return (
    <ErrorPage
      code={500}
      title="Server Error"
      message="Something went wrong on our end. Our team has been notified and is working to fix the issue. Please try again in a few moments."
    />
  );
}

export function MaintenancePage() {
  return (
    <ErrorPage
      code={503}
      title="Under Maintenance"
      message="We're currently performing scheduled maintenance. We'll be back online shortly. Thank you for your patience."
    />
  );
}

export function ForbiddenPage() {
  return (
    <ErrorPage
      code={403}
      title="Access Denied"
      message="You don't have permission to access this resource. Please contact an administrator if you believe this is an error."
    />
  );
}
