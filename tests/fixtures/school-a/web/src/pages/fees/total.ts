// Same rule as the server: sessions * price, 10% off from the 20th session.
export function feeTotal(sessions: number, pricePerDay: number) {
  const base = sessions * pricePerDay;
  return sessions >= 20 ? Math.round(base * 0.9) : base;
}
