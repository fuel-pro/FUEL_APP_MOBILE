import {
  ArrowLeft,
  Shield,
  Lock,
  Eye,
  Database,
  Trash2,
  Mail,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)",
        color: "#fff",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <button
          onClick={() => navigate("/")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            color: "#fff",
            fontSize: 14,
            cursor: "pointer",
            marginBottom: 32,
          }}
        >
          <ArrowLeft size={16} /> Back to App
        </button>

        <header style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 36, fontWeight: "bold", marginBottom: 8 }}>
            🔒 Privacy Policy
          </h1>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>
            Last updated: June 6, 2026
          </p>
        </header>

        {/* Quick Nav */}
        <nav
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: 12,
            padding: 20,
            marginBottom: 32,
          }}
        >
          <h3 style={{ fontSize: 14, color: "#9ca3af", marginBottom: 12 }}>
            Quick Navigation
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              "Information Collection",
              "Data Usage",
              "Data Storage",
              "Your Rights",
              "Cookies",
              "Contact",
            ].map(item => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                style={{
                  padding: "6px 12px",
                  background: "rgba(245,158,11,0.15)",
                  borderRadius: 6,
                  color: "#f59e0b",
                  fontSize: 12,
                  textDecoration: "none",
                }}
              >
                {item}
              </a>
            ))}
          </div>
        </nav>

        {/* Content Sections */}
        <section id="information-collection" style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Eye size={24} style={{ color: "#f59e0b" }} />
            Information We Collect
          </h2>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h4 style={{ fontSize: 16, marginBottom: 12 }}>
              Personal Information
            </h4>
            <ul
              style={{
                fontSize: 14,
                color: "#9ca3af",
                lineHeight: 1.8,
                paddingLeft: 20,
              }}
            >
              <li>
                Account credentials (email, password - stored securely hashed)
              </li>
              <li>Station management data (names, locations, settings)</li>
              <li>Sales transactions and inventory records</li>
              <li>Fuel pricing information</li>
              <li>M-PESA transaction data (for payment integration)</li>
            </ul>

            <h4 style={{ fontSize: 16, margin: "20px 0 12px" }}>
              Automatically Collected
            </h4>
            <ul
              style={{
                fontSize: 14,
                color: "#9ca3af",
                lineHeight: 1.8,
                paddingLeft: 20,
              }}
            >
              <li>Device information and browser type</li>
              <li>Usage patterns and feature interactions</li>
              <li>Crash reports and performance data</li>
              <li>IP address (for security and geo-targeting)</li>
            </ul>
          </div>
        </section>

        <section id="data-usage" style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Database size={24} style={{ color: "#f59e0b" }} />
            How We Use Your Data
          </h2>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <ul
              style={{
                fontSize: 14,
                color: "#9ca3af",
                lineHeight: 2,
                paddingLeft: 20,
              }}
            >
              <li>
                <strong style={{ color: "#fff" }}>Service Delivery:</strong>{" "}
                Provide fuel management functionality across your devices
              </li>
              <li>
                <strong style={{ color: "#fff" }}>Sync & Backup:</strong> Enable
                cloud synchronization between devices
              </li>
              <li>
                <strong style={{ color: "#fff" }}>Security:</strong> Detect and
                prevent unauthorized access
              </li>
              <li>
                <strong style={{ color: "#fff" }}>Analytics:</strong> Improve
                app features and user experience
              </li>
              <li>
                <strong style={{ color: "#fff" }}>Communications:</strong> Send
                important service updates (opt-out available)
              </li>
            </ul>
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: "rgba(239,68,68,0.1)",
                borderRadius: 8,
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <p style={{ fontSize: 13, color: "#f87171", margin: 0 }}>
                ⚠️ We <strong>never</strong> sell your personal data to third
                parties or advertisers.
              </p>
            </div>
          </div>
        </section>

        <section id="data-storage" style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Shield size={24} style={{ color: "#f59e0b" }} />
            Data Storage & Security
          </h2>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h4 style={{ fontSize: 16, marginBottom: 12 }}>Encryption</h4>
            <ul
              style={{
                fontSize: 14,
                color: "#9ca3af",
                lineHeight: 1.8,
                paddingLeft: 20,
              }}
            >
              <li>All data encrypted in transit (TLS 1.3)</li>
              <li>Passwords hashed with Argon2 algorithm</li>
              <li>Local data encrypted on device storage</li>
            </ul>

            <h4 style={{ fontSize: 16, margin: "20px 0 12px" }}>
              Storage Providers
            </h4>
            <p style={{ fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
              Your data may be stored on secure cloud services (Supabase,
              Firebase, or self-hosted Seafile) depending on your organization's
              configuration. All providers comply with GDPR and maintain SOC 2
              Type II certifications.
            </p>
          </div>
        </section>

        <section id="your-rights" style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Lock size={24} style={{ color: "#f59e0b" }} />
            Your Rights
          </h2>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 16 }}>
              You have full control over your data:
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              {[
                {
                  icon: "📥",
                  title: "Data Export",
                  desc: "Download all your data in JSON format",
                },
                {
                  icon: "✏️",
                  title: "Data Correction",
                  desc: "Update or correct any personal information",
                },
                {
                  icon: "🗑️",
                  title: "Data Deletion",
                  desc: "Request complete removal of your data",
                },
                {
                  icon: "🚫",
                  title: "Opt-out",
                  desc: "Unsubscribe from marketing communications",
                },
              ].map(right => (
                <div
                  key={right.title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: 24 }}>{right.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {right.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                      {right.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="cookies" style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            🍪 Cookie Policy
          </h2>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: "#9ca3af",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              We use minimal cookies to ensure the app functions correctly:
            </p>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  fontSize: 13,
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <th
                      style={{ textAlign: "left", padding: 12, color: "#fff" }}
                    >
                      Type
                    </th>
                    <th
                      style={{ textAlign: "left", padding: 12, color: "#fff" }}
                    >
                      Purpose
                    </th>
                    <th
                      style={{ textAlign: "left", padding: 12, color: "#fff" }}
                    >
                      Required
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <td style={{ padding: 12, color: "#9ca3af" }}>
                      Authentication
                    </td>
                    <td style={{ padding: 12, color: "#9ca3af" }}>
                      Keep you logged in
                    </td>
                    <td style={{ padding: 12, color: "#10b981" }}>Yes</td>
                  </tr>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <td style={{ padding: 12, color: "#9ca3af" }}>
                      Preferences
                    </td>
                    <td style={{ padding: 12, color: "#9ca3af" }}>
                      Remember your settings
                    </td>
                    <td style={{ padding: 12, color: "#10b981" }}>Yes</td>
                  </tr>
                  <tr>
                    <td style={{ padding: 12, color: "#9ca3af" }}>Analytics</td>
                    <td style={{ padding: 12, color: "#9ca3af" }}>
                      Improve our app
                    </td>
                    <td style={{ padding: 12, color: "#f59e0b" }}>No</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="contact" style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Mail size={24} style={{ color: "#f59e0b" }} />
            Contact Us
          </h2>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: "#9ca3af",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              For privacy inquiries, data export requests, or to report security
              issues:
            </p>
            <div
              style={{
                display: "flex",
                gap: 16,
                padding: 16,
                background: "rgba(245,158,11,0.1)",
                borderRadius: 8,
                border: "1px solid rgba(245,158,11,0.2)",
              }}
            >
              <Mail size={20} style={{ color: "#f59e0b" }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  privacy@fuelpro.app
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  We respond within 48 hours
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 12, color: "#6b7280" }}>
            © 2026 FuelPro. All rights reserved. • Version 1.0.0
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              marginTop: 12,
            }}
          >
            <a href="#/terms" style={{ fontSize: 12, color: "#9ca3af" }}>
              Terms of Service
            </a>
            <span style={{ color: "#4b5563" }}>|</span>
            <a href="#/" style={{ fontSize: 12, color: "#9ca3af" }}>
              Home
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
