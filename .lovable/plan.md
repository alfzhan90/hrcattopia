

## Malaysian HR & Payroll Attendance System — Step 1

### Database Schema (Supabase)
- **branches** table: id, name, address, latitude, longitude, radius_meters (default 100)
- **staff_profiles** table: user_id (FK to auth.users), staff_id (auto-format STF-YYYY-XXX), name, ic_number, kwsp_number, socso_number, employment_type (Monthly-FT / Hourly-FT), base_rate, ot_rate_per_hour, branch_id (FK), device_id, al_balance, mc_balance
- **attendance_logs** table: id, user_id, branch_id, check_in_time, check_out_time, check_in_lat, check_in_long, status (on_time / late / out_of_range)
- **user_roles** table for admin/staff role separation
- RLS policies on all tables with security definer helper functions

### Authentication
- Email/password login & signup
- Role-based access: **admin** and **staff** roles
- Protected routes — admin pages only accessible to admins
- Auth context with session management

### Branch Management UI (Admin)
- Split layout: Google Maps on top/left, data table on bottom/right
- Map shows branch markers with radius circles (geofence visualization)
- Click map to set lat/lng when adding a new branch
- CRUD forms: add, edit, delete branches with name, address, coordinates, radius
- Branch list table with search/filter

### Pages & Navigation
- `/login` — Auth page (login/signup)
- `/admin/branches` — Branch management (map + table)
- `/admin/staff` — Staff listing (placeholder for next step)
- Sidebar navigation for admin sections
- Redirect unauthenticated users to login

### Google Maps Integration
- Interactive map with branch markers and geofence radius circles
- Click-to-place for setting branch coordinates
- Will use `@react-google-maps/api` library (you'll need to provide a Google Maps API key)

