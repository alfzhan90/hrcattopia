// Generate payslip PDF using browser-native canvas → PDF approach
// We'll use jsPDF for simplicity

export interface PayslipData {
  companyName: string;
  month: string; // e.g. "January 2026"
  staffId: string;
  staffName: string;
  icNumber: string;
  kwspNumber: string;
  socsoNumber: string;
  branchName: string;
  employmentType: string;
  // Earnings
  basicPay: number;
  otPay: number;
  allowance: number;
  commission: number;
  holidayPay: number;
  grossPay: number;
  // Deductions
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  socsoEmployer: number;
  eisEmployee: number;
  eisEmployer: number;
  pcb: number;
  uplDeduction: number;
  netPay: number;
}

export const generatePayslipPdf = async (data: PayslipData): Promise<Blob> => {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = 210;
  const lm = 15;
  const rm = pw - 15;
  let y = 15;

  const fmt = (n: number) => `RM ${n.toFixed(2)}`;

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.companyName, pw / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("PAYSLIP", pw / 2, y, { align: "center" });
  y += 5;
  doc.text(data.month, pw / 2, y, { align: "center" });
  y += 8;

  // Line
  doc.setLineWidth(0.5);
  doc.line(lm, y, rm, y);
  y += 6;

  // Staff Info (2 columns)
  doc.setFontSize(9);
  const infoLeft = [
    ["Staff ID", data.staffId],
    ["Name", data.staffName],
    ["IC Number", data.icNumber],
    ["Branch", data.branchName],
  ];
  const infoRight = [
    ["KWSP No", data.kwspNumber || "—"],
    ["SOCSO No", data.socsoNumber || "—"],
    ["Employment", data.employmentType],
  ];

  infoLeft.forEach(([label, val], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, lm, y + i * 5);
    doc.setFont("helvetica", "normal");
    doc.text(val, lm + 28, y + i * 5);
  });
  infoRight.forEach(([label, val], i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, pw / 2 + 5, y + i * 5);
    doc.setFont("helvetica", "normal");
    doc.text(val, pw / 2 + 30, y + i * 5);
  });

  y += Math.max(infoLeft.length, infoRight.length) * 5 + 4;
  doc.line(lm, y, rm, y);
  y += 6;

  // Earnings & Deductions side by side
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("EARNINGS", lm, y);
  doc.text("DEDUCTIONS", pw / 2 + 5, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  const earnings = [
    ["Basic Pay", data.basicPay],
    ["Overtime Pay", data.otPay],
    ["Allowance", data.allowance],
    ["Commission", data.commission],
    ["Holiday Pay", data.holidayPay],
  ] as const;

  const deductions = [
    ["EPF (Employee 11%)", data.epfEmployee],
    ["SOCSO (Employee)", data.socsoEmployee],
    ["EIS (Employee)", data.eisEmployee],
    ["PCB (Tax)", data.pcb],
    ["Unpaid Leave", data.uplDeduction],
  ] as const;

  const maxRows = Math.max(earnings.length, deductions.length);
  for (let i = 0; i < maxRows; i++) {
    if (i < earnings.length) {
      doc.text(earnings[i][0], lm, y + i * 5);
      doc.text(fmt(earnings[i][1]), pw / 2 - 5, y + i * 5, { align: "right" });
    }
    if (i < deductions.length) {
      doc.text(deductions[i][0], pw / 2 + 5, y + i * 5);
      doc.text(fmt(deductions[i][1]), rm, y + i * 5, { align: "right" });
    }
  }

  y += maxRows * 5 + 3;
  doc.line(lm, y, rm, y);
  y += 5;

  // Totals
  doc.setFont("helvetica", "bold");
  doc.text("Gross Pay", lm, y);
  doc.text(fmt(data.grossPay), pw / 2 - 5, y, { align: "right" });
  doc.text("Total Deductions", pw / 2 + 5, y);
  const totalDeductions = data.epfEmployee + data.socsoEmployee + data.eisEmployee + data.pcb + data.uplDeduction;
  doc.text(fmt(totalDeductions), rm, y, { align: "right" });
  y += 7;

  // Net Pay
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.line(lm, y, rm, y);
  y += 7;
  doc.text("NET PAY", lm, y);
  doc.text(fmt(data.netPay), rm, y, { align: "right" });
  y += 4;
  doc.line(lm, y, rm, y);

  y += 10;

  // Employer contributions (info)
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text("Employer Contributions (not deducted from salary):", lm, y);
  y += 4;
  doc.text(`EPF Employer: ${fmt(data.epfEmployer)} | SOCSO Employer: ${fmt(data.socsoEmployer)} | EIS Employer: ${fmt(data.eisEmployer)}`, lm, y);
  y += 8;
  doc.text("This is a computer-generated payslip. No signature required.", pw / 2, y, { align: "center" });

  return doc.output("blob");
};
