import { formatDistanceToNow } from "date-fns/formatDistanceToNow";

/** "$22,000" for whole dollars, "$474.28" when there are cents. Input is in dollars. */
export function money(dollars: number): string {
  const whole = Math.abs(dollars - Math.round(dollars)) < 0.005;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(dollars);
}

/** Same as {@link money} but takes integer cents (the unit finance.ts works in). */
export const moneyC = (cents: number) => money(cents / 100);

export const percent = (n: number) => `${n.toFixed(1)}%`;

export const miles = (n: number) => `${n.toLocaleString("en-US")} mi`;

export const listedAgo = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

export const titleCase = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
};

/** "2019 Tesla Model 3 Standard Range" -> "2019 Tesla Model 3". */
export const shortCar = (car: string) => {
  const p = car.split(" ");
  return p.slice(0, /^\d$/.test(p[3] ?? "") ? 4 : 3).join(" ");
};
