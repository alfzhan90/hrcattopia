export interface FreelancerInvoiceData {
  companyName: string;
  companyAddress: string;
  companySSM: string;
  invoiceNumber: string;
  freelancerName: string;
  freelancerIC: string;
  freelancerStaffId: string;
  bankName: string;
  bankAccount: string;
  month: string;
  periodLabel: string;
  serviceDescription: string;
  totalHours: number;
  hourlyRate: number;
  totalPayable: number;
  eInvoiceId: string;
  paymentDueDate: string;
}

export const generateFreelancerInvoicePdf = async (data: FreelancerInvoiceData): Promise<Blob> => {
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
  doc.text("INVOICE / SELF-BILLING", pw / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.invoiceNumber, pw / 2, y, { align: "center" });
  y += 8;

  doc.setLineWidth(0.5);
  doc.line(lm, y, rm, y);
  y += 6;

  // Bill To / From
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", lm, y);
  doc.text("SERVICE PROVIDER:", pw / 2 + 5, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  const billTo = [data.companyName, data.companyAddress, `SSM: ${data.companySSM}`].filter(Boolean);
  const provider = [
    data.freelancerName,
    `ID: ${data.freelancerStaffId}`,
    `IC/Passport: ${data.freelancerIC}`,
    data.bankName ? `Bank: ${data.bankName}` : "",
    data.bankAccount ? `Account: ${data.bankAccount}` : "",
  ].filter(Boolean);

  const maxInfo = Math.max(billTo.length, provider.length);
  for (let i = 0; i < maxInfo; i++) {
    if (i < billTo.length) doc.text(billTo[i], lm, y + i * 4.5);
    if (i < provider.length) doc.text(provider[i], pw / 2 + 5, y + i * 4.5);
  }
  y += maxInfo * 4.5 + 4;

  doc.line(lm, y, rm, y);
  y += 6;

  // Period & Dates
  doc.setFont("helvetica", "bold");
  doc.text("Period:", lm, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.month} (${data.periodLabel})`, lm + 20, y);
  y += 5;
  if (data.paymentDueDate) {
    doc.setFont("helvetica", "bold");
    doc.text("Payment Due:", lm, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.paymentDueDate, lm + 28, y);
    y += 5;
  }
  if (data.eInvoiceId) {
    doc.setFont("helvetica", "bold");
    doc.text("e-Invoice ID:", lm, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.eInvoiceId, lm + 28, y);
    y += 5;
  }
  y += 3;

  // Service Table Header
  doc.setFillColor(240, 240, 240);
  doc.rect(lm, y, rm - lm, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Description", lm + 2, y + 5);
  doc.text("Hours", 100, y + 5, { align: "center" });
  doc.text("Rate (RM/hr)", 135, y + 5, { align: "center" });
  doc.text("Amount (RM)", rm - 2, y + 5, { align: "right" });
  y += 10;

  // Service Row
  doc.setFont("helvetica", "normal");
  doc.text(data.serviceDescription, lm + 2, y);
  doc.text(data.totalHours.toFixed(1), 100, y, { align: "center" });
  doc.text(data.hourlyRate.toFixed(2), 135, y, { align: "center" });
  doc.text(data.totalPayable.toFixed(2), rm - 2, y, { align: "right" });
  y += 7;

  doc.line(lm, y, rm, y);
  y += 7;

  // Total
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL PAYABLE", lm, y);
  doc.text(fmt(data.totalPayable), rm, y, { align: "right" });
  y += 4;
  doc.line(lm, y, rm, y);

  y += 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text("This is a computer-generated invoice under the Self-Billing arrangement.", pw / 2, y, { align: "center" });
  y += 4;
  doc.text("For LHDN e-Invoice compliance (transactions >RM10,000), ensure the e-Invoice Unique Identifier is filled.", pw / 2, y, { align: "center" });

  return doc.output("blob");
};
