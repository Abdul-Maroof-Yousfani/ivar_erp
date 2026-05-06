# Employee Setup

## Overview
This module handles the core management of employee records, from onboarding to exit.

## Sections

### 1. Employee
- **Create:** Add new employees to the system. Capture personal details, official info, salary structure, and more.
  - *Path:* `/hr/employee/create`
- **List:** View, filter, and search all employees. Access detailed profiles.
  - *Path:* `/hr/employee/list`
- **User Accounts:** Manage system login credentials for employees. Link employee profiles to user accounts.
  - *Path:* `/hr/employee/user-account`

### 2. Exit Clearance
- **Create:** Initiate the exit process for an employee (resignation or termination).
  - *Path:* `/hr/exit-clearance/create`
- **List:** Track the status of exit clearances and final settlements.
  - *Path:* `/hr/exit-clearance/list`

## Key Features
- **Full Profile Management:** Personal info, contact details, bank info, etc.
- **Document Management:** Upload and store employee documents.
- **Role Integration:** Assign roles and permissions via User Accounts.
