# RBAC & User Management Flow

This document outlines the complete flow for managing users, roles, and permissions within the system.

## 1. Centralized Login
- **URL:** `http://auth.localtest.me:3001/`
- **Description:** This is the single entry point for all users (Admin, HR, Employees).
- **Process:** Users enter their email and password. Upon successful authentication, they are redirected to the dashboard or module they have access to.

## 2. Role Management (Admin Panel)
Only Super Admins or designated System Admins have access to this section.

### Create Role
- **URL:** `http://admin.localtest.me:3001/create`
- **Action:** Create new roles (e.g., "HR Manager", "Payroll Executive", "Employee").
- **Permission Assignment:** While creating a role, the admin selects specific permissions (e.g., `employee.read`, `payroll.create`). These permissions dictate exactly what menu items and actions a user with this role can see and perform.

### View Roles
- **URL:** `http://admin.localtest.me:3001/roles`
- **Action:** View a list of all existing roles, their descriptions, and the number of users assigned to them.

## 3. User Account Creation & Role Assignment
This process links an Employee profile to a System User account.

### Create User Account
- **URL:** `/hr/employee/user-account/create`
- **Action:**
  1. Select an existing Employee from the dropdown.
  2. The system generates or allows entry of an email and password.
  3. **Role Assignment:** Select the Role created in step 2 (e.g., "Sales Executive").
- **Outcome:** The employee now has login credentials. When they log in, they will ONLY see the modules and perform actions allowed by their assigned Role.

### Manage User Accounts
- **URL:** `/hr/employee/user-account`
- **Action:**
  - View all users who have system access.
  - Edit user roles (e.g., promote an employee by changing their role from "Associate" to "Manager").
  - Reset passwords or deactivate accounts.
