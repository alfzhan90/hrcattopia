---
name: Payroll & Compliance Module
description: Malaysia 2026 payroll with EPF/SOCSO/EIS statutory calculations, leave/holiday management, PDF payslips
type: feature
---
- EPF: Employee 11%, Employer 13% (≤RM5k) or 12% (>RM5k)
- SOCSO: Category 1 tiered table, RM6,000 ceiling
- EIS: 0.2% each side, RM6,000 ceiling
- PCB: Manual field (admin enters amount)
- Tables: public_holidays, leave_records, payroll_runs
- Leave types: AL, MC, UPL (enum)
- Payroll status: draft → released
- Staff self-service at /staff/dashboard (view AL/MC balance, attendance history, download released payslips)
- Admin payroll at /admin/payroll (4 tabs: Payroll, Time Correction, Leave, Holidays)
- PDF payslips generated client-side with jsPDF
- Company name: CATTOPIA SDN BHD
