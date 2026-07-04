/**
 * Demo Data Generator
 * Provides sample data when no backend/localStorage data exists
 */

export interface DemoStation {
  id: string;
  name: string;
  location: string;
  pumps: number;
  fuelType: string;
}

export interface DemoSale {
  id: string;
  date: string;
  fuelType: string;
  quantity: number;
  amount: number;
  paymentMethod: string;
}

export interface DemoKPI {
  totalRevenue: number;
  netProfit: number;
  fuelSold: number;
  balanceDue: number;
  todaySales: number;
  transactions: number;
}

// Generate demo station data
export function getDemoStations(): DemoStation[] {
  return [
    { id: "demo-1", name: "Nairobi Central Station", location: "Nairobi, KE", pumps: 8, fuelType: "Petrol/Diesel" },
    { id: "demo-2", name: "Mombasa Highway Station", location: "Mombasa, KE", pumps: 6, fuelType: "Petrol/Diesel/Kerosene" },
    { id: "demo-3", name: "Kisumu Port Station", location: "Kisumu, KE", pumps: 4, fuelType: "Petrol/Diesel" },
  ];
}

// Generate demo sales for last 7 days
export function getDemoSales(): DemoSale[] {
  const sales: DemoSale[] = [];
  const fuelTypes = ["Petrol", "Diesel", "Kerosene"];
  const paymentMethods = ["M-PESA", "Cash", "Credit"];
  
  for (let d = 6; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split("T")[0];
    
    // 5-10 transactions per day
    const txCount = Math.floor(Math.random() * 6) + 5;
    for (let i = 0; i < txCount; i++) {
      const fuelType = fuelTypes[Math.floor(Math.random() * fuelTypes.length)];
      const qty = Math.floor(Math.random() * 50) + 10;
      const pricePerLiter = fuelType === "Petrol" ? 193.43 : fuelType === "Diesel" ? 178.56 : 170.22;
      
      sales.push({
        id: `sale-${dateStr}-${i}`,
        date: dateStr,
        fuelType,
        quantity: qty,
        amount: Math.round(qty * pricePerLiter),
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      });
    }
  }
  return sales;
}

// Calculate demo KPIs from sales
export function getDemoKPIs(): DemoKPI {
  const sales = getDemoSales();
  const today = new Date().toISOString().split("T")[0];
  
  let totalRevenue = 0;
  let fuelSold = 0;
  let todaySales = 0;
  
  sales.forEach(sale => {
    totalRevenue += sale.amount;
    fuelSold += sale.quantity;
    if (sale.date === today) {
      todaySales += sale.amount;
    }
  });
  
  // Add some variance to make it look realistic
  return {
    totalRevenue: Math.round(totalRevenue),
    netProfit: Math.round(totalRevenue * 0.15), // ~15% profit margin
    fuelSold: Math.round(fuelSold),
    balanceDue: Math.round(totalRevenue * 0.08), // ~8% on credit
    todaySales: todaySales || Math.round(totalRevenue / 7), // If no today sales, use average
    transactions: sales.length,
  };
}

// Get sales chart data for last 7 days
export function getDemoChartData(): { labels: string[]; revenue: number[]; fuel: number[] } {
  const labels: string[] = [];
  const revenue: number[] = [];
  const fuel: number[] = [];
  const sales = getDemoSales();
  
  for (let d = 6; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split("T")[0];
    labels.push(date.toLocaleDateString("en-US", { weekday: "short" }));
    
    const daySales = sales.filter(s => s.date === dateStr);
    revenue.push(daySales.reduce((sum, s) => sum + s.amount, 0));
    fuel.push(daySales.reduce((sum, s) => sum + s.quantity, 0));
  }
  
  return { labels, revenue, fuel };
}

// Get fuel distribution data
export function getDemoFuelDistribution(): { petrol: number; diesel: number; kerosene: number } {
  const sales = getDemoSales();
  let petrol = 0, diesel = 0, kerosene = 0;
  
  sales.forEach(sale => {
    if (sale.fuelType === "Petrol") petrol += sale.quantity;
    else if (sale.fuelType === "Diesel") diesel += sale.quantity;
    else kerosene += sale.quantity;
  });
  
  return { petrol: Math.round(petrol), diesel: Math.round(diesel), kerosene: Math.round(kerosene) };
}

// Check if app has any real data
export function hasRealData(): boolean {
  try {
    // Check for any fuelpro_* keys in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("fuelpro_")) {
        const val = localStorage.getItem(key);
        if (val && val !== "{}" && val !== "[]") {
          return true;
        }
      }
    }
    // Also check for station data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes("station")) {
        return true;
      }
    }
  } catch {
    // localStorage not available
  }
  return false;
}

// Get current fuel prices (Kenya defaults)
export function getCurrentFuelPrices(): { petrol: number; diesel: number; kerosene: number } {
  return {
    petrol: 193.43,
    diesel: 178.56,
    kerosene: 170.22,
  };
}

export default {
  getDemoStations,
  getDemoSales,
  getDemoKPIs,
  getDemoChartData,
  getDemoFuelDistribution,
  hasRealData,
  getCurrentFuelPrices,
};