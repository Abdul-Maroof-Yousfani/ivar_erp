# Working Hours Policy

## Overview
This module allows you to define and manage different work schedules (shifts) for your organization. You can create policies specifying start/end times, grace periods, and break durations.

## Actions

### 1. Create
- **Description:** Define a new working hour policy.
- **Fields:** 
  - Policy Name (e.g., "General Shift", "Night Shift")
  - Start Time & End Time
  - Grace Period (minutes allowed for late arrival)
  - Break Duration
- **Path:** `/hr/working-hours/create`

### 2. View
- **Description:** List all existing working hour policies. You can edit or delete policies from here.
- **Path:** `/hr/working-hours/view`

### 3. Assign Policy
- **Description:** Assign a specific working hour policy to employees or departments. This determines how their attendance is calculated (late, early exit, etc.).
- **Path:** `/hr/working-hours/assign-policy`
