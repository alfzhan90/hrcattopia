/**
 * CP8D (e-Data Praisi) Pipe-Delimited Text File Generator
 * Format: LHDN Specification for MTD Data
 */

export interface CP8DEmployeeRow {
  name: string;
  icNumber: string;
  passportNumber: string;
  taxRefNumber: string;
  totalGross: number;
  totalMtd: number;
  totalEpfEmployee: number;
}

export interface CP8DHeader {
  employerName: string;
  employerTaxRef: string; // e.g. SSM or E-number
  year: number;
  totalEmployees: number;
}

export const generateCP8DFile = (header: CP8DHeader, rows: CP8DEmployeeRow[]): string => {
  const lines: string[] = [];

  // Header record (H)
  lines.push(
    [
      "H",
      header.employerName,
      header.employerTaxRef,
      header.year.toString(),
      header.totalEmployees.toString(),
    ].join("|")
  );

  // Detail records (D)
  rows.forEach((row, idx) => {
    lines.push(
      [
        "D",
        (idx + 1).toString(),
        row.name,
        row.icNumber,
        row.passportNumber || "",
        row.taxRefNumber || "",
        row.totalGross.toFixed(2),
        row.totalMtd.toFixed(2),
        row.totalEpfEmployee.toFixed(2),
      ].join("|")
    );
  });

  // Footer record (T)
  const totalGross = rows.reduce((s, r) => s + r.totalGross, 0);
  const totalMtd = rows.reduce((s, r) => s + r.totalMtd, 0);
  const totalEpf = rows.reduce((s, r) => s + r.totalEpfEmployee, 0);

  lines.push(
    [
      "T",
      rows.length.toString(),
      totalGross.toFixed(2),
      totalMtd.toFixed(2),
      totalEpf.toFixed(2),
    ].join("|")
  );

  return lines.join("\r\n");
};
