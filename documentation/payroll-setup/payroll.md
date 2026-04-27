# Payroll Generation

## Overview
This module is the core of the payroll system. It handles the monthly generation of salaries, calculation of taxes, and distribution of payslips.

## Actions

### 1. Create Payroll
- **Description:** Run the payroll process for a specific month and year.
- **Process:**
  1. Select Month and Year.
  2. The system automatically calculates salaries based on attendance, allowances, deductions, and tax slabs.
  3. Review the generated sheet before finalizing.
- **Path:** `/hr/payroll-setup/payroll/create`

### 2. View Report
- **Description:** detailed reports of generated payrolls.
- **Features:**
  - Filter by Department, Employee, or Date.
  - Export to Excel/PDF.
- **Path:** `/hr/payroll-setup/payroll/report`

### 3. Bank Report
- **Description:** Generate the bank transfer letter or file required for salary disbursement.
- **Path:** `/hr/payroll-setup/payroll/bank-report`

### 4. Payslips Emails
- **Description:** Dashboard to manage and send salary slips to employees via email.
- **Path:** `/hr/payroll-setup/payroll/payslips`
