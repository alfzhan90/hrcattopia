// Malaysian 2026 Statutory Calculation Helpers

/** Calculate rest hours: 1 hour for every 5 hours worked */
export const calcRestHours = (totalHours: number): number => {
  return Math.floor(totalHours / 5);
};

/** Calculate net hours after rest deduction */
export const calcNetHours = (totalHours: number): number => {
  const rest = calcRestHours(totalHours);
  return Math.max(totalHours - rest, 0);
};

/** Calculate daily OT: net hours exceeding 8 at 1.5x */
export const calcDailyOt = (netHours: number): number => {
  return Math.max(netHours - 8, 0);
};

/** Calculate base hourly rate: (Basic Salary / 26 days) / 8 hours */
export const calcHourlyRate = (monthlySalary: number): number => {
  return monthlySalary / 26 / 8;
};

/** EPF Employee: 11% */
export const calcEpfEmployee = (salary: number) => Math.round(salary * 0.11 * 100) / 100;

/** EPF Employer: 13% if salary <= 5000, else 12% */
export const calcEpfEmployer = (salary: number) =>
  Math.round(salary * (salary <= 5000 ? 0.13 : 0.12) * 100) / 100;

/** SOCSO Category 1 (Employment Injury + Invalidity) — 2026 tiered table up to RM6,000 ceiling */
const SOCSO_TABLE: Array<{ ceiling: number; employee: number; employer: number }> = [
  { ceiling: 30, employee: 0.1, employer: 0.4 },
  { ceiling: 50, employee: 0.15, employer: 0.7 },
  { ceiling: 70, employee: 0.2, employer: 0.95 },
  { ceiling: 100, employee: 0.25, employer: 1.2 },
  { ceiling: 140, employee: 0.3, employer: 1.45 },
  { ceiling: 200, employee: 0.35, employer: 1.65 },
  { ceiling: 300, employee: 0.5, employer: 2.4 },
  { ceiling: 400, employee: 0.65, employer: 3.1 },
  { ceiling: 500, employee: 0.75, employer: 3.7 },
  { ceiling: 600, employee: 0.85, employer: 4.2 },
  { ceiling: 700, employee: 1.0, employer: 4.9 },
  { ceiling: 800, employee: 1.1, employer: 5.5 },
  { ceiling: 900, employee: 1.25, employer: 6.2 },
  { ceiling: 1000, employee: 1.35, employer: 6.8 },
  { ceiling: 1100, employee: 1.5, employer: 7.45 },
  { ceiling: 1200, employee: 1.6, employer: 8.05 },
  { ceiling: 1300, employee: 1.75, employer: 8.75 },
  { ceiling: 1400, employee: 1.85, employer: 9.35 },
  { ceiling: 1500, employee: 2.0, employer: 9.95 },
  { ceiling: 1600, employee: 2.1, employer: 10.55 },
  { ceiling: 1700, employee: 2.25, employer: 11.25 },
  { ceiling: 1800, employee: 2.35, employer: 11.85 },
  { ceiling: 1900, employee: 2.5, employer: 12.45 },
  { ceiling: 2000, employee: 2.6, employer: 13.05 },
  { ceiling: 2100, employee: 2.75, employer: 13.75 },
  { ceiling: 2200, employee: 2.85, employer: 14.35 },
  { ceiling: 2300, employee: 3.0, employer: 14.95 },
  { ceiling: 2400, employee: 3.1, employer: 15.55 },
  { ceiling: 2500, employee: 3.25, employer: 16.25 },
  { ceiling: 2600, employee: 3.35, employer: 16.85 },
  { ceiling: 2700, employee: 3.5, employer: 17.45 },
  { ceiling: 2800, employee: 3.6, employer: 18.05 },
  { ceiling: 2900, employee: 3.75, employer: 18.75 },
  { ceiling: 3000, employee: 3.85, employer: 19.35 },
  { ceiling: 3100, employee: 4.0, employer: 19.95 },
  { ceiling: 3200, employee: 4.1, employer: 20.55 },
  { ceiling: 3300, employee: 4.25, employer: 21.25 },
  { ceiling: 3400, employee: 4.35, employer: 21.85 },
  { ceiling: 3500, employee: 4.5, employer: 22.45 },
  { ceiling: 3600, employee: 4.6, employer: 23.05 },
  { ceiling: 3700, employee: 4.75, employer: 23.75 },
  { ceiling: 3800, employee: 4.85, employer: 24.35 },
  { ceiling: 3900, employee: 5.0, employer: 24.95 },
  { ceiling: 4000, employee: 5.1, employer: 25.55 },
  { ceiling: 4100, employee: 5.25, employer: 26.25 },
  { ceiling: 4200, employee: 5.35, employer: 26.85 },
  { ceiling: 4300, employee: 5.5, employer: 27.45 },
  { ceiling: 4400, employee: 5.6, employer: 28.05 },
  { ceiling: 4500, employee: 5.75, employer: 28.75 },
  { ceiling: 4600, employee: 5.85, employer: 29.35 },
  { ceiling: 4700, employee: 6.0, employer: 29.95 },
  { ceiling: 4800, employee: 6.1, employer: 30.55 },
  { ceiling: 4900, employee: 6.25, employer: 31.25 },
  { ceiling: 5000, employee: 6.35, employer: 31.85 },
  { ceiling: 5100, employee: 6.5, employer: 32.45 },
  { ceiling: 5200, employee: 6.6, employer: 33.05 },
  { ceiling: 5300, employee: 6.75, employer: 33.75 },
  { ceiling: 5400, employee: 6.85, employer: 34.35 },
  { ceiling: 5500, employee: 7.0, employer: 34.95 },
  { ceiling: 5600, employee: 7.1, employer: 35.55 },
  { ceiling: 5700, employee: 7.25, employer: 36.25 },
  { ceiling: 5800, employee: 7.35, employer: 36.85 },
  { ceiling: 5900, employee: 7.5, employer: 37.45 },
  { ceiling: 6000, employee: 7.6, employer: 38.05 },
];

export const calcSocso = (salary: number): { employee: number; employer: number } => {
  const capped = Math.min(salary, 6000);
  const tier = SOCSO_TABLE.find((t) => capped <= t.ceiling) ?? SOCSO_TABLE[SOCSO_TABLE.length - 1];
  return { employee: tier.employee, employer: tier.employer };
};

/** EIS: 0.2% each (employee + employer) with RM6,000 ceiling */
export const calcEis = (salary: number): { employee: number; employer: number } => {
  const capped = Math.min(salary, 6000);
  const amount = Math.round(capped * 0.002 * 100) / 100;
  return { employee: amount, employer: amount };
};

/** Calculate daily rate from monthly salary (assume 26 working days) */
export const dailyRate = (monthlySalary: number) => monthlySalary / 26;

/** Calculate UPL deduction */
export const calcUplDeduction = (monthlySalary: number, uplDays: number) =>
  Math.round(dailyRate(monthlySalary) * uplDays * 100) / 100;
