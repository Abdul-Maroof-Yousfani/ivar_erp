# User Dashboard

## Overview
The User Dashboard is the personalized landing page for every logged-in user. Its content is dynamically rendered based on the user's assigned Role and Permissions.

## Dynamic Visibility
Unlike a static dashboard, the HRMS dashboard adapts to the user:

- **Restricted Menu:** The sidebar will **only** show menu items the user has permission to see.
  - *Example:* A standard "Employee" role will NOT see "Payroll Setup" or "Settings", but will see "My Dashboard", "Leaves", and "Attendance".
- **Widgets:** The cards and charts on the home page reflect data relevant to the user's scope.
  - *Admin:* Sees organization-wide stats (Total Employees, Total Payroll Cost).
  - *Employee:* Sees personal stats (My Attendance, My Leave Balance, My Loan Status).

## Common User Modules
For a typical employee with basic access, the dashboard provides access to:

### 1. My Profile
- View personal details, employment history, and documents.

### 2. Attendance
- **View:** Check daily clock-in/out times.
- **Request:** Submit attendance correction requests if they forgot to clock in.

### 3. Leaves
- **Balance:** View remaining Casual, Sick, and Annual leaves.
- **Apply:** Submit a leave application.
- **History:** View status of past leave applications (Pending, Approved, Rejected).

### 4. Payroll (Self)
- **Payslips:** Download monthly salary slips.
- **Loans:** View status of loan applications and remaining installments.
- **Provident Fund:** View personal PF balance and contribution history.
