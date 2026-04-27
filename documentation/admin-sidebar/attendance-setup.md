# Attendance Setup

## Overview
Manages employee attendance, working hours, and holiday schedules.

## Sections

### 1. Attendance
- **Manage:** Manual adjustments and oversight of attendance records.
  - *Path:* `/hr/attendance/manage`
- **View:** Detailed view of attendance logs (Clock In/Out).
  - *Path:* `/hr/attendance/view`
- **Summary:** Aggregated attendance data for reporting.
  - *Path:* `/hr/attendance/summary`
- **Request:** Employees can request attendance corrections.
  - *Path:* `/hr/attendance/request`
- **Request List:** Managers view and approve/reject attendance requests.
  - *Path:* `/hr/attendance/request-list`
- **Exemptions:** Manage exemptions for specific employees (e.g., late arrival allowed).
  - *Path:* `/hr/attendance/exemptions`
- **Request Forwarding:** Configure approval workflows for attendance requests.
  - *Path:* `/hr/request-forwarding?type=attendance`

### 2. Working Hours Policy
- **Create:** Define shifts and working hour rules (Start Time, End Time, Grace Period).
  - *Path:* `/hr/working-hours/create`
- **View:** List of all working hour policies.
  - *Path:* `/hr/working-hours/view`
- **Assign Policy:** Assign specific policies to employees or departments.
  - *Path:* `/hr/working-hours/assign-policy`

### 3. Holidays
- **Create:** Add company or public holidays to the calendar.
  - *Path:* `/hr/holidays/add`
- **List:** View upcoming and past holidays.
  - *Path:* `/hr/holidays/list`
