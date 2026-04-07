import jsPDF from "jspdf";

export interface EAFormData {
  year: number;
  companyName: string;
  companyAddress: string;
  ssmNumber: string;
  staffName: string;
  staffId: string;
  icNumber: string;
  passportNumber?: string;
  taxRefNumber?: string;
  kwspNumber?: string;
  socsoNumber?: string;
  grossSalary: number;
  allowances: number;
  commissions: number;
  otPay: number;
  holidayPay: number;
  totalGross: number;
  epfEmployee: number;
  socsoEmployee: number;
  eisEmployee: number;
  pcb: number;
  totalDeductions: number;
  netPay: number;
  monthsWorked: number;
}

export const generateEAFormPdf = (data: EAFormData): jsPDF => {
  const doc = new jsPDF("p", "mm", "a4");
  const pw = 210;
  const margin = 15;
  const cw = pw - margin * 2;
  let y = margin;

  const fmt = (n: number) => `RM ${n.toFixed(2)}`;

  // Header
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("LEMBAGA HASIL DALAM NEGERI MALAYSIA", pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.text("INLAND REVENUE BOARD OF MALAYSIA", pw / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("EA FORM / BORANG EA", pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`STATEMENT OF REMUNERATION FROM EMPLOYMENT FOR THE YEAR ${data.year}`, pw / 2, y, { align: "center" });
  y += 5;
  doc.text(`PENYATA SARAAN DARIPADA PENGGAJIAN BAGI TAHUN ${data.year}`, pw / 2, y, { align: "center" });
  y += 3;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pw - margin, y);
  y += 8;

  // Section A - Employer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("A. PARTICULARS OF EMPLOYER / BUTIRAN MAJIKAN", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const addRow = (label: string, value: string) => {
    doc.text(label, margin + 2, y);
    doc.text(`: ${value}`, margin + 70, y);
    y += 5.5;
  };

  addRow("Name of Employer", data.companyName);
  addRow("SSM Reg. No.", data.ssmNumber);
  addRow("Address", data.companyAddress);
  y += 3;

  // Section B - Employee
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("B. PARTICULARS OF EMPLOYEE / BUTIRAN PEKERJA", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  addRow("Name of Employee", data.staffName);
  addRow("Staff ID", data.staffId);
  addRow("IC Number / No. K/P", data.icNumber);
  if (data.passportNumber) addRow("Passport No.", data.passportNumber);
  if (data.taxRefNumber) addRow("Income Tax Ref No.", data.taxRefNumber);
  if (data.kwspNumber) addRow("KWSP No.", data.kwspNumber);
  if (data.socsoNumber) addRow("SOCSO No.", data.socsoNumber);
  y += 3;

  // Section C - Remuneration
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("C. REMUNERATION DETAILS / BUTIRAN SARAAN", margin, y);
  y += 8;

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, cw, 7, "F");
  doc.setFontSize(8);
  doc.text("DESCRIPTION", margin + 2, y);
  doc.text("AMOUNT (RM)", pw - margin - 2, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const earningsRows = [
    ["1. Basic Salary / Gaji Pokok", fmt(data.grossSalary)],
    ["2. Overtime Pay / Bayaran Kerja Lebih Masa", fmt(data.otPay)],
    ["3. Allowances / Elaun", fmt(data.allowances)],
    ["4. Commission / Komisen", fmt(data.commissions)],
    ["5. Holiday Pay / Bayaran Hari Kelepasan", fmt(data.holidayPay)],
  ];

  earningsRows.forEach(([label, val]) => {
    doc.text(label, margin + 4, y);
    doc.text(val, pw - margin - 2, y, { align: "right" });
    y += 5.5;
  });

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL GROSS REMUNERATION / JUMLAH SARAAN KASAR", margin + 4, y);
  doc.text(fmt(data.totalGross), pw - margin - 2, y, { align: "right" });
  y += 8;

  // Section D - Deductions
  doc.setFontSize(10);
  doc.text("D. DEDUCTIONS / POTONGAN", margin, y);
  y += 8;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, cw, 7, "F");
  doc.setFontSize(8);
  doc.text("DESCRIPTION", margin + 2, y);
  doc.text("AMOUNT (RM)", pw - margin - 2, y, { align: "right" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const deductionRows = [
    ["1. EPF / KWSP (Employee)", fmt(data.epfEmployee)],
    ["2. SOCSO / PERKESO (Employee)", fmt(data.socsoEmployee)],
    ["3. EIS / SIP (Employee)", fmt(data.eisEmployee)],
    ["4. PCB / MTD", fmt(data.pcb)],
  ];

  deductionRows.forEach(([label, val]) => {
    doc.text(label, margin + 4, y);
    doc.text(val, pw - margin - 2, y, { align: "right" });
    y += 5.5;
  });

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL DEDUCTIONS / JUMLAH POTONGAN", margin + 4, y);
  doc.text(fmt(data.totalDeductions), pw - margin - 2, y, { align: "right" });
  y += 8;

  // Net
  doc.setFontSize(11);
  doc.text("NET PAY / GAJI BERSIH", margin + 4, y);
  doc.text(fmt(data.netPay), pw - margin - 2, y, { align: "right" });
  y += 10;

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Months Worked: ${data.monthsWorked}`, margin, y);
  y += 5;
  doc.text("This is a computer-generated statement. No signature is required.", margin, y);
  y += 4;
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, y);

  return doc;
};
