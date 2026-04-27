# Implementation Plan: Permissions System

## Overview

This implementation plan creates a comprehensive role-based access control (RBAC) permissions system for the HR management application. The system will provide granular control over 250+ permissions across 50+ modules, supporting standard CRUD operations, approval workflows, and bulk operations.

## Tasks

- [ ] 1. Create permissions data structure and seeding system
- [ ] 1.1 Create permissions.ts file with comprehensive permission definitions
  - Define all 250+ permissions following module.action naming convention
  - Organize permissions by functional modules (Master Data, HR, Financial, Administrative, Reporting)
  - Include descriptions for each permission
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 1.2 Create permission seeding service
  - Implement service to seed permissions into database
  - Handle permission updates without losing existing role assignments
  - Validate permission structure during seeding
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 1.3 Write unit tests for permission data structure
  - Test permission naming convention validation
  - Test duplicate permission detection
  - Test permission categorization
  - _Requirements: 1.1, 1.5_

- [ ] 2. Implement Master Data module permissions
- [ ] 2.1 Define allocation management permissions
  - Create allocation.create, allocation.read, allocation.update, allocation.delete permissions
  - Create allocation.bulk_create, allocation.bulk_update, allocation.bulk_delete permissions
  - _Requirements: 2.1_

- [ ] 2.2 Define department management permissions
  - Create department.create, department.read, department.update, department.delete permissions
  - Create department.bulk_create, department.bulk_update, department.bulk_delete permissions
  - _Requirements: 2.2_

- [ ] 2.3 Define employee grade management permissions
  - Create employee_grade.create, employee_grade.read, employee_grade.update, employee_grade.delete permissions
  - Create employee_grade.bulk_create, employee_grade.bulk_update, employee_grade.bulk_delete permissions
  - _Requirements: 2.3_

- [ ] 2.4 Define designation management permissions
  - Create designation.create, designation.read, designation.update, designation.delete permissions
  - Create designation.bulk_create, designation.bulk_update, designation.bulk_delete permissions
  - _Requirements: 2.4_

- [ ] 2.5 Define location management permissions
  - Create location.create, location.read, location.update, location.delete permissions
  - Create location.bulk_create, location.bulk_update, location.bulk_delete permissions
  - _Requirements: 2.5_

- [ ] 2.6 Define bank management permissions
  - Create bank.create, bank.read, bank.update, bank.delete permissions
  - Create bank.bulk_create, bank.bulk_update, bank.bulk_delete permissions
  - _Requirements: 2.6_

- [ ] 2.7 Define city management permissions
  - Create city.create, city.read, city.update, city.delete permissions
  - Create city.bulk_create, city.bulk_update, city.bulk_delete permissions
  - _Requirements: 2.7_

- [ ] 2.8 Define qualification and institute management permissions
  - Create qualification.create, qualification.read, qualification.update, qualification.delete permissions
  - Create institute.create, institute.read, institute.update, institute.delete permissions
  - _Requirements: 2.8, 2.9_

- [ ] 2.9 Define equipment management permissions
  - Create equipment.create, equipment.read, equipment.update, equipment.delete permissions
  - Create equipment.bulk_create, equipment.bulk_update, equipment.bulk_delete permissions
  - _Requirements: 2.10_

- [ ]* 2.10 Write property tests for master data permissions
  - **Property 1: Master data permission completeness**
  - **Validates: Requirements 2.1-2.10**

- [ ] 3. Implement HR Management module permissions
- [ ] 3.1 Define employee management permissions
  - Create employee.create, employee.read, employee.update, employee.delete permissions
  - Create employee.import, employee.export, employee.rejoin permissions
  - _Requirements: 3.1_

- [ ] 3.2 Define attendance management permissions
  - Create attendance.create, attendance.read, attendance.update, attendance.delete permissions
  - Create attendance.manage, attendance.view_summary permissions
  - Create attendance.exemption.create, attendance.exemption.approve permissions
  - _Requirements: 3.2_

- [ ] 3.3 Define leave management permissions
  - Create leave.create, leave.read, leave.update, leave.delete permissions
  - Create leave.approve, leave.encash permissions
  - _Requirements: 3.3_

- [ ] 3.4 Define payroll management permissions
  - Create payroll.create, payroll.read, payroll.update, payroll.delete permissions
  - Create payroll.generate, payroll.approve permissions
  - _Requirements: 3.4_

- [ ] 3.5 Define bonus management permissions
  - Create bonus.create, bonus.read, bonus.update, bonus.delete permissions
  - Create bonus.approve permission
  - _Requirements: 3.5_

- [ ] 3.6 Define allowance management permissions
  - Create allowance.create, allowance.read, allowance.update, allowance.delete permissions
  - Create allowance.approve permission
  - Create allowance_head.create, allowance_head.read, allowance_head.update, allowance_head.delete permissions
  - _Requirements: 3.6_

- [ ] 3.7 Define deduction management permissions
  - Create deduction.create, deduction.read, deduction.update, deduction.delete permissions
  - Create deduction.approve permission
  - Create deduction_head.create, deduction_head.read, deduction_head.update, deduction_head.delete permissions
  - _Requirements: 3.7_

- [ ] 3.8 Define loan request management permissions
  - Create loan_request.create, loan_request.read, loan_request.update, loan_request.delete permissions
  - Create loan_request.approve permission
  - _Requirements: 3.8_

- [ ] 3.9 Define overtime request management permissions
  - Create overtime_request.create, overtime_request.read, overtime_request.update, overtime_request.delete permissions
  - Create overtime_request.approve permission
  - _Requirements: 3.9_

- [ ] 3.10 Define increment management permissions
  - Create increment.create, increment.read, increment.update, increment.delete permissions
  - Create increment.approve permission
  - _Requirements: 3.10_

- [ ]* 3.11 Write property tests for HR management permissions
  - **Property 2: HR permission approval workflow completeness**
  - **Validates: Requirements 3.1-3.10**

- [ ] 4. Implement Financial module permissions
- [ ] 4.1 Define advance salary management permissions
  - Create advance_salary.create, advance_salary.read, advance_salary.update, advance_salary.delete permissions
  - Create advance_salary.approve permission
  - _Requirements: 4.1_

- [ ] 4.2 Define provident fund management permissions
  - Create provident_fund.create, provident_fund.read, provident_fund.update, provident_fund.delete permissions
  - Create pf_withdrawal.create, pf_withdrawal.read, pf_withdrawal.update, pf_withdrawal.delete permissions
  - Create pf_withdrawal.approve permission
  - _Requirements: 4.2_

- [ ] 4.3 Define EOBI management permissions
  - Create eobi.create, eobi.read, eobi.update, eobi.delete permissions
  - _Requirements: 4.3_

- [ ] 4.4 Define social security management permissions
  - Create social_security.institution.create, social_security.institution.read, social_security.institution.update, social_security.institution.delete permissions
  - Create social_security.employer_registration.create, social_security.employer_registration.read, social_security.employer_registration.update, social_security.employer_registration.delete permissions
  - Create social_security.employee_registration.create, social_security.employee_registration.read, social_security.employee_registration.update, social_security.employee_registration.delete permissions
  - Create social_security.contribution.create, social_security.contribution.read, social_security.contribution.update, social_security.contribution.delete permissions
  - Create social_security.register permission
  - _Requirements: 4.4_

- [ ] 4.5 Define tax slab management permissions
  - Create tax_slab.create, tax_slab.read, tax_slab.update, tax_slab.delete permissions
  - Create tax_slab.bulk_create, tax_slab.bulk_update, tax_slab.bulk_delete permissions
  - _Requirements: 4.5_

- [ ] 4.6 Define rebate management permissions
  - Create rebate.create, rebate.read, rebate.update, rebate.delete permissions
  - Create rebate.approve permission
  - Create rebate_nature.create, rebate_nature.read, rebate_nature.update, rebate_nature.delete permissions
  - _Requirements: 4.6_

- [ ] 4.7 Define salary breakup management permissions
  - Create salary_breakup.create, salary_breakup.read, salary_breakup.update, salary_breakup.delete permissions
  - _Requirements: 4.7_

- [ ]* 4.8 Write property tests for financial permissions
  - **Property 3: Financial permission security completeness**
  - **Validates: Requirements 4.1-4.7**

- [ ] 5. Implement Administrative module permissions
- [ ] 5.1 Define user management permissions
  - Create user.create, user.read, user.update, user.delete permissions
  - Create user.reset_password, user.lock, user.unlock permissions
  - _Requirements: 5.1_

- [ ] 5.2 Define role management permissions
  - Create role.create, role.read, role.update, role.delete permissions
  - Create role.assign_permissions permission
  - _Requirements: 5.2_

- [ ] 5.3 Define activity log permissions
  - Create activity_log.read, activity_log.export permissions
  - _Requirements: 5.3_

- [ ] 5.4 Define system configuration permissions
  - Create system_config.read, system_config.update permissions
  - _Requirements: 5.4_

- [ ] 5.5 Define working hours policy permissions
  - Create working_hours_policy.create, working_hours_policy.read, working_hours_policy.update, working_hours_policy.delete permissions
  - Create working_hours_policy.assign permission
  - _Requirements: 5.5_

- [ ] 5.6 Define holiday management permissions
  - Create holiday.create, holiday.read, holiday.update, holiday.delete permissions
  - _Requirements: 5.6_

- [ ] 5.7 Define request forwarding permissions
  - Create request_forwarding.create, request_forwarding.read, request_forwarding.update, request_forwarding.delete permissions
  - _Requirements: 5.7_

- [ ]* 5.8 Write unit tests for administrative permissions
  - Test user management permission validation
  - Test role management permission validation
  - _Requirements: 5.1-5.7_

- [ ] 6. Implement Policy and Configuration permissions
- [ ] 6.1 Define leave policy management permissions
  - Create leave_policy.create, leave_policy.read, leave_policy.update, leave_policy.delete permissions
  - Create leave_policy.assign permission
  - _Requirements: 6.1_

- [ ] 6.2 Define approval settings permissions
  - Create approval_setting.create, approval_setting.read, approval_setting.update, approval_setting.delete permissions
  - _Requirements: 6.3_

- [ ] 6.3 Define exit clearance permissions
  - Create exit_clearance.create, exit_clearance.read, exit_clearance.update, exit_clearance.delete permissions
  - Create exit_clearance.approve permission
  - _Requirements: 6.4_

- [ ]* 6.4 Write property tests for policy permissions
  - **Property 4: Policy permission assignment completeness**
  - **Validates: Requirements 6.1-6.4**

- [ ] 7. Implement Reporting and Analytics permissions
- [ ] 7.1 Define attendance report permissions
  - Create report.attendance.read, report.attendance.export permissions
  - _Requirements: 7.1_

- [ ] 7.2 Define payroll report permissions
  - Create report.payroll.read, report.payroll.export permissions
  - _Requirements: 7.2_

- [ ] 7.3 Define employee report permissions
  - Create report.employee.read, report.employee.export permissions
  - _Requirements: 7.3_

- [ ] 7.4 Define leave report permissions
  - Create report.leave.read, report.leave.export permissions
  - _Requirements: 7.4_

- [ ] 7.5 Define financial report permissions
  - Create report.financial.read, report.financial.export permissions
  - _Requirements: 7.5_

- [ ] 7.6 Define loan report permissions
  - Create report.loan.read, report.loan.export permissions
  - _Requirements: 7.6_

- [ ]* 7.7 Write unit tests for reporting permissions
  - Test report access permission validation
  - Test export permission validation
  - _Requirements: 7.1-7.6_

- [ ] 8. Implement bulk operations permissions
- [ ] 8.1 Define bulk create permissions for all applicable modules
  - Add bulk_create permissions to master data modules
  - Add bulk_create permissions to HR modules where applicable
  - _Requirements: 9.1_

- [ ] 8.2 Define bulk update permissions for all applicable modules
  - Add bulk_update permissions to master data modules
  - Add bulk_update permissions to HR modules where applicable
  - _Requirements: 9.2_

- [ ] 8.3 Define bulk delete permissions for all applicable modules
  - Add bulk_delete permissions to master data modules
  - Add bulk_delete permissions to HR modules where applicable
  - _Requirements: 9.3_

- [ ] 8.4 Define import/export permissions for all applicable modules
  - Add import permissions for data import operations
  - Add export permissions for data export operations
  - _Requirements: 9.4, 9.5_

- [ ]* 8.5 Write property tests for bulk operations
  - **Property 5: Bulk operation permission consistency**
  - **Validates: Requirements 9.1-9.5**

- [ ] 9. Create default roles and permission assignments
- [ ] 9.1 Define Super Admin role
  - Create role with all permissions
  - Set as default admin role
  - _Requirements: 10.2_

- [ ] 9.2 Define HR Manager role
  - Assign all HR and employee management permissions
  - Include reporting permissions for HR modules
  - _Requirements: 10.2_

- [ ] 9.3 Define Finance Manager role
  - Assign payroll, financial, and tax management permissions
  - Include financial reporting permissions
  - _Requirements: 10.2_

- [ ] 9.4 Define Department Head role
  - Assign employee and attendance management for department scope
  - Include basic reporting permissions
  - _Requirements: 10.2_

- [ ] 9.5 Define HR Officer role
  - Assign basic HR operations permissions
  - Exclude approval and sensitive financial permissions
  - _Requirements: 10.2_

- [ ] 9.6 Define Employee role
  - Assign self-service permissions (view own profile, apply leave, etc.)
  - Include read-only access to own data
  - _Requirements: 10.2_

- [ ]* 9.7 Write unit tests for default roles
  - Test role creation and permission assignment
  - Test role hierarchy and permission inheritance
  - _Requirements: 10.2_

- [ ] 10. Checkpoint - Ensure all permissions are defined and seeded
- Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Create permission validation service
- [ ] 11.1 Implement permission checking service
  - Create service to verify user permissions before actions
  - Implement hierarchical permission checking
  - Add caching for performance optimization
  - _Requirements: 8.1, 8.4, 8.5_

- [ ] 11.2 Implement permission denial handling
  - Return appropriate error responses for unauthorized access
  - Log permission check failures for audit
  - _Requirements: 8.2, 8.3_

- [ ]* 11.3 Write property tests for permission validation
  - **Property 6: Permission validation consistency**
  - **Validates: Requirements 8.1-8.5**

- [ ] 12. Integration and final testing
- [ ] 12.1 Integrate permission system with existing authentication
  - Connect permission validation with JWT auth guards
  - Update existing controllers to use permission checks
  - _Requirements: 8.1_

- [ ] 12.2 Create permission management API endpoints
  - Create endpoints for managing permissions and roles
  - Add proper authorization to permission management endpoints
  - _Requirements: 5.1, 5.2_

- [ ]* 12.3 Write integration tests
  - Test end-to-end permission validation flows
  - Test role assignment and permission inheritance
  - _Requirements: 8.1-8.5_

- [ ] 13. Final checkpoint - Ensure all tests pass
- Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The system supports 250+ permissions across 50+ modules
- Permissions follow module.action naming convention
- Bulk operations have separate permissions for security
- Approval workflows are supported through specialized permissions