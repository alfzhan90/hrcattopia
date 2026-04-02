## Payroll & Compliance Module — Implementation Plan

### 1. Database Changes (Single Migration)
- **`public_holidays`** table: `id`, `name`, `date`, `multiplier` (2.0 or 3.0), `created_at`
- **`leave_records`** table: `id`, `staff_profile_id`, `leave_type` (enum: AL, MC, UPL), `date`, `approved_by`, `created_at`
- **`payroll_runs`** table: `id`, `month` (date), `staff_profile_id`, `basic_pay`, `ot_pay`, `allowance`, `commission`, `holiday_pay`, `gross_pay`, `epf_employee`, `epf_employer`, `socso_employee`, `socso_employer`, `eis_employee`, `eis_employer`, `pcb`, `upl_deduction`, `net_pay`, `status` (enum: draft, released), `released_at`, `created_at`
- Enum: `leave_type` (AL, MC, UPL)
- Enum: `payroll_status` (draft, released)
- RLS: Admin full access on all new tables. Staff can view own payroll_runs when status='released'.

### 2. Admin Payroll Dashboard (`/admin/payroll`)
- **Attendance Correction**: Table of attendance logs with inline edit for check-in/out times
- **Leave Management**: Set/update AL & MC balances on staff_profiles; mark leave days (AL/MC/UPL)
- **Holiday Calendar**: CRUD for public holidays with multiplier
- **Payroll Processing**: Select month → calculate pay for all staff → review → release
  - EPF: Employee 11%, Employer 13% (≤RM5k) or 12% (>RM5k)
  - SOCSO Cat 1 + EIS 0.2% each with RM6k ceiling
  - PCB: Manual input field
  - Holiday multiplier applied automatically
  - UPL auto-deducts from gross

### 3. Staff Self-Service Portal (`/staff/payslips`)
- View AL/MC balance
- View past attendance history
- View released payslips + download PDF

### 4. PDF Payslip Generation
- Company name header, Staff ID, IC, KWSP No, SOCSO No
- Earnings breakdown: Basic + OT + Allowance + Commission + Holiday Pay
- Deductions breakdown: EPF + SOCSO + EIS + PCB + UPL
- Net Pay

### 5. Routing & Navigation
- Add `/admin/payroll` to AdminLayout sidebar
- Add `/staff/dashboard` for staff self-service
- Update navigation for staff role
