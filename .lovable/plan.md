## Step 2: Attendance Engine & Security

### 1. Database Changes (Migration)
- Add `regular_hours` and `ot_hours` (numeric) columns to `attendance_logs`
- Add `device_fingerprint` text column alias — already have `device_id` on `staff_profiles`

### 2. Mobile Attendance Page (`/attendance`)
- Staff-only route at `/attendance`
- Two large buttons: **Check In** / **Check Out**
- Live Google Map showing assigned branch geofence circle + staff's current position
- Status display: current check-in state, distance from branch

### 3. GPS Geofencing Logic
- Use `navigator.geolocation.getCurrentPosition()` on check-in
- Haversine formula to calculate distance to assigned branch
- If within `radius_meters` → allow check-in, save to `attendance_logs`
- If outside → block with red alert showing distance and branch name

### 4. Device Binding (One Phone Rule)
- Generate device fingerprint from `navigator.userAgent` + screen dimensions + timezone
- On first check-in: save fingerprint to `staff_profiles.device_id`
- On subsequent check-ins: compare fingerprint — block if mismatch
- Show security error message if device doesn't match

### 5. Admin Controls
- **Staff page**: Add "Reset Device" button per staff member (clears `device_id`)
- **Live Attendance dashboard**: New admin page showing currently checked-in staff with distance from branch

### 6. Check-Out & Time Calculation
- On check-out: calculate duration from `check_in_time`
- `regular_hours` = min(duration, 8)
- `ot_hours` = max(duration - 8, 0)
- Save both to `attendance_logs`

### Pages & Routes
- `/attendance` — Staff attendance page (staff role)
- `/admin/attendance` — Live attendance dashboard (admin role)
- Update `/admin/staff` — Full staff management with device reset
