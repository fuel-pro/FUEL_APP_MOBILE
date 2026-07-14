interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatFn?: (value: number) => string;
}

export default function AnimatedNumber({
  value,
  formatFn,
}: AnimatedNumberProps) {
  const displayValue = formatFn ? formatFn(value) : value.toLocaleString();
  return <span>{displayValue}</span>;
}
