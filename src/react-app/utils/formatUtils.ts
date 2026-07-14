export const formatNumber = (num: number, decimals: number = 2): string => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatCurrency = (
  amount: number,
  currency: string = "KES"
): string => {
  return `${currency} ${formatNumber(amount, 2)}`;
};

export const formatDate = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatAmountWithCommas = (amount: number | string): string => {
  const num =
    typeof amount === "string"
      ? parseFloat(amount.replace(/,/g, "")) || 0
      : amount;
  return formatNumber(num, 2);
};

export const parseNumberFromFormatted = (value: string): number => {
  return parseFloat(value.replace(/,/g, "")) || 0;
};
