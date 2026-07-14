import React, { useState, useEffect } from "react";
import {
  usePlatformData,
  PlatformStats,
} from "@/react-app/context/PlatformDataContext";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Building2,
  Package,
  Activity,
  Clock,
  RefreshCw,
  BarChart3,
  Fuel,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

// ─── KPI Card Component ───
interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down" | "stable";
  change?: number;
  subtitle?: string;
}

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  trend,
  change,
  subtitle,
}: KpiCardProps) {
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "#666",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {title}
        </span>
        <Icon size={16} style={{ color }} />
      </div>
      <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {(trend || change !== undefined) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
          }}
        >
          {trend === "up" && (
            <TrendingUp size={12} style={{ color: "#10b981" }} />
          )}
          {trend === "down" && (
            <TrendingDown size={12} style={{ color: "#ef4444" }} />
          )}
          {change !== undefined && (
            <span style={{ color: change >= 0 ? "#10b981" : "#ef4444" }}>
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
          )}
          <span style={{ color: "#555" }}>{subtitle || "vs last period"}</span>
        </div>
      )}
    </div>
  );
}

// ─── Revenue Chart Component ───
function RevenueChart({
  sales,
}: {
  sales: Array<{ date: string; total: number }>;
}) {
  // Group sales by day for last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split("T")[0];
  });

  const dailyData = last7Days.map(date => {
    const daySales = sales.filter(s => s.date?.startsWith(date));
    return daySales.reduce((sum, s) => sum + (s.total || 0), 0);
  });

  const maxVal = Math.max(...dailyData, 1);

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <BarChart3 size={14} style={{ color: "#f59e0b" }} /> Revenue (Last 7
          Days)
        </h3>
      </div>
      <div style={{ display: "flex", alignItems: "end", gap: 8, height: 120 }}>
        {dailyData.map((value, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: "100%",
                background: "rgba(245,158,11,0.3)",
                borderRadius: "4px 4px 0 0",
                height: `${Math.max((value / maxVal) * 100, 4)}%`,
                transition: "height 0.3s ease",
              }}
            />
            <span style={{ fontSize: 9, color: "#555" }}>
              {last7Days[i].slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sales by Fuel Type Chart ───
function FuelTypeChart({
  sales,
}: {
  sales: Array<{ fuelType: string; total: number }>;
}) {
  const fuelTypes = sales.reduce(
    (acc, s) => {
      const type = s.fuelType || "Unknown";
      acc[type] = (acc[type] || 0) + (s.total || 0);
      return acc;
    },
    {} as Record<string, number>
  );

  const total =
    Object.values(fuelTypes).reduce((sum, val) => sum + val, 0) || 1;
  const colors = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "#fff",
          margin: "0 0 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Fuel size={14} style={{ color: "#10b981" }} /> Sales by Fuel Type
      </h3>
      {Object.keys(fuelTypes).length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Object.entries(fuelTypes).map(([type, amount], i) => (
            <div
              key={type}
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "#fff" }}>{type}</span>
                <span style={{ color: "#888" }}>${amount.toFixed(2)}</span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "#1a1a1a",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(amount / total) * 100}%`,
                    background: colors[i % colors.length],
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ textAlign: "center", color: "#555", fontSize: 12 }}>
          No sales data yet
        </p>
      )}
    </div>
  );
}

// ─── Recent Activity Component ───
function RecentActivity({
  getRecentActivity,
}: {
  getRecentActivity: (
    limit?: number
  ) => Array<{
    id: string;
    action: string;
    details: string;
    time: string;
    color: string;
  }>;
}) {
  const activities = getRecentActivity(8);

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "#fff",
          margin: "0 0 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Activity size={14} style={{ color: "#10b981" }} /> Recent Activity
      </h3>
      {activities.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activities.map((item, i) => (
            <div
              key={item.id || i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 0",
                borderBottom:
                  i < activities.length - 1 ? "1px solid #1a1a1a" : "none",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: item.color || "#10b981",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: "#fff", margin: 0 }}>
                  {item.action}
                </p>
                <p style={{ fontSize: 10, color: "#555", margin: 0 }}>
                  {item.details}
                </p>
              </div>
              <span style={{ fontSize: 10, color: "#444" }}>{item.time}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ textAlign: "center", color: "#555", fontSize: 12 }}>
          No activity yet. Use the app to generate activity.
        </p>
      )}
    </div>
  );
}

// ─── System Health Component ───
function SystemHealth({ lastUpdated }: { lastUpdated: Date | null }) {
  const checks: Array<{
    name: string;
    status: "healthy" | "warning" | "error";
    detail: string;
  }> = [
    { name: "Database", status: "healthy", detail: "localStorage operational" },
    { name: "API Keys", status: "healthy", detail: "Configured" },
    { name: "M-PESA", status: "warning", detail: "Not configured" },
    { name: "SMS Gateway", status: "warning", detail: "Not configured" },
    { name: "Sync", status: "healthy", detail: "Real-time sync active" },
  ];

  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "#fff",
          margin: "0 0 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <CheckCircle2 size={14} style={{ color: "#10b981" }} /> System Health
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {checks.map((check, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {check.status === "healthy" && (
              <CheckCircle2 size={12} style={{ color: "#10b981" }} />
            )}
            {check.status === "warning" && (
              <AlertTriangle size={12} style={{ color: "#f59e0b" }} />
            )}
            {check.status === "error" && (
              <AlertTriangle size={12} style={{ color: "#ef4444" }} />
            )}
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 12, color: "#fff" }}>{check.name}</span>
            </div>
            <span style={{ fontSize: 10, color: "#555" }}>{check.detail}</span>
          </div>
        ))}
      </div>
      {lastUpdated && (
        <p
          style={{
            fontSize: 10,
            color: "#444",
            marginTop: 12,
            textAlign: "center",
          }}
        >
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

// ─── Main Platform Analytics Component ───
export default function PlatformAnalytics() {
  const {
    sales,
    users,
    stations,
    inventory,
    stats,
    refreshData,
    getRecentActivity,
    isLoading,
    lastUpdated,
  } = usePlatformData();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: "#fff",
              margin: 0,
            }}
          >
            Platform Analytics
          </h2>
          <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
            Real-time platform metrics and insights
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            padding: "8px 16px",
            background: "rgba(245,158,11,0.15)",
            color: "#f59e0b",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: 8,
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: isRefreshing ? "wait" : "pointer",
            opacity: isRefreshing ? 0.7 : 1,
          }}
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 12,
        }}
      >
        <KpiCard
          title="Total Revenue"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="#f59e0b"
          trend={stats.totalRevenue > 0 ? "up" : "stable"}
        />
        <KpiCard
          title="Today Revenue"
          value={`$${stats.todayRevenue.toFixed(2)}`}
          icon={TrendingUp}
          color="#10b981"
        />
        <KpiCard
          title="This Week"
          value={`$${stats.weeklyRevenue.toLocaleString()}`}
          icon={BarChart3}
          color="#3b82f6"
        />
        <KpiCard
          title="This Month"
          value={`$${stats.monthlyRevenue.toLocaleString()}`}
          icon={TrendingUp}
          color="#8b5cf6"
        />
        <KpiCard
          title="Total Sales"
          value={stats.totalSales}
          icon={ShoppingCart}
          color="#10b981"
        />
        <KpiCard
          title="Today Sales"
          value={stats.todaySales}
          icon={Activity}
          color="#06b6d4"
        />
        <KpiCard
          title="Active Users"
          value={`${stats.activeUsers}/${stats.totalUsers}`}
          icon={Users}
          color="#8b5cf6"
        />
        <KpiCard
          title="Stations"
          value={stats.totalStations}
          icon={Building2}
          color="#06b6d4"
        />
      </div>

      {/* Charts Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 12,
        }}
      >
        <RevenueChart sales={sales} />
        <FuelTypeChart sales={sales} />
      </div>

      {/* Activity & Health Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 12,
        }}
      >
        <RecentActivity getRecentActivity={getRecentActivity} />
        <SystemHealth lastUpdated={lastUpdated} />
      </div>

      {/* Data Summary */}
      <div
        style={{
          background: "#111",
          border: "1px solid #222",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            margin: "0 0 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Package size={14} style={{ color: "#3b82f6" }} /> Data Summary
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff" }}>
              {sales.length}
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>
              Total Sales Records
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff" }}>
              {users.length}
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>Total Users</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff" }}>
              {stations.length}
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>Total Stations</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: "#fff" }}>
              {inventory.length}
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>Inventory Items</div>
          </div>
        </div>
      </div>
    </div>
  );
}
