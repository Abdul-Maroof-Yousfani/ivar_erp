# Attendance Sandwich System

## Overview
The Sandwich System is an automated attendance rule that marks weekend days (Saturday and Sunday) as absent when an employee is absent on both the Friday before and Monday after those weekend days.

## How It Works

### Rule Logic
When an employee is marked as **absent** on:
- **Friday** AND **Monday** (surrounding a weekend)
- **AND neither Friday nor Monday has an approved leave**

Then the system automatically:
- Marks **Saturday** as absent
- Marks **Sunday** as absent
- Adds a note: "Sandwich rule applied - absent due to Friday and Monday absence"

### Important Exception: Approved Leaves
**The sandwich rule will NOT be applied if:**
- Friday has an approved leave application
- Monday has an approved leave application
- Any approved leave covers the Friday-to-Monday period

This ensures that employees who have taken legitimate approved leaves are not penalized with sandwich rule absences on the weekend.

### Reverse Logic (Auto-Removal)
When an employee's status is changed from **absent** to **present** (or any other status) on:
- **Friday** OR **Monday**

Then the system automatically:
- Removes the sandwich rule from **Saturday** and **Sunday**
- Deletes weekend attendance records that were created by the sandwich rule
- Preserves manually created weekend attendance records

### Trigger Points
The sandwich rule is automatically applied when:
1. Creating a new attendance record with status "absent"
2. Updating an existing attendance record to status "absent"

### Example Scenario

**Scenario 1: Applying Sandwich Rule**

*Before Sandwich Rule:*
- Friday (Jan 5): Absent ❌
- Saturday (Jan 6): No record
- Sunday (Jan 7): No record  
- Monday (Jan 8): Absent ❌

*After Sandwich Rule Applied:*
- Friday (Jan 5): Absent ❌
- Saturday (Jan 6): Absent ❌ (Auto-marked by sandwich rule)
- Sunday (Jan 7): Absent ❌ (Auto-marked by sandwich rule)
- Monday (Jan 8): Absent ❌

**Scenario 2: Approved Leave - NO Sandwich Rule**

*Setup:*
- Friday (Jan 5): Absent ❌ (Has approved leave)
- Saturday (Jan 6): No record
- Sunday (Jan 7): No record  
- Monday (Jan 8): Absent ❌ (Has approved leave)

*Result:*
- Friday (Jan 5): Absent ❌ (Approved leave)
- Saturday (Jan 6): No record (Sandwich rule NOT applied)
- Sunday (Jan 7): No record (Sandwich rule NOT applied)
- Monday (Jan 8): Absent ❌ (Approved leave)

**Scenario 3: Removing Sandwich Rule**

*Before Status Change:*
- Friday (Jan 5): Absent ❌
- Saturday (Jan 6): Absent ❌ (Sandwich rule applied)
- Sunday (Jan 7): Absent ❌ (Sandwich rule applied)
- Monday (Jan 8): Absent ❌

*After Changing Friday to Present:*
- Friday (Jan 5): Present ✅
- Saturday (Jan 6): Removed (was created by sandwich rule)
- Sunday (Jan 7): Removed (was created by sandwich rule)
- Monday (Jan 8): Absent ❌

## Deduction Impact

Weekend days marked as absent through the sandwich rule will be included in:
- **Attendance deduction calculations in payroll** - Each absent weekend day counts as a full day deduction
- Absence counts in attendance reports
- Monthly attendance summaries

### How Payroll Calculates Weekend Absences

The payroll system has been updated to:
1. **Check for explicit absence records on weekends/holidays** before skipping them
2. **Count weekend absences** created by the sandwich rule in deduction calculations
3. **Apply per-day salary deduction** for each absent weekend day

**Example Calculation:**
- Basic Salary: 45,000
- Days in Month: 30
- Per Day Salary: 45,000 ÷ 30 = 1,500

If Friday, Saturday, Sunday, and Monday are all absent:
- Absent Days: 4
- Deduction: 4 × 1,500 = **6,000**

This ensures that employees cannot avoid deductions by only marking weekdays as absent while taking the full week off.

## Technical Implementation

### Backend Service
Location: `nestjs_backend/src/attendance/attendance.service.ts`

**Key Methods:**
- `applySandwichRule()` - Checks if Friday/Monday are both absent and triggers weekend marking, or removes sandwich rule if status changes
- `markWeekendAsAbsent()` - Creates or updates Saturday and Sunday attendance records as absent
- `removeWeekendSandwichRule()` - Removes weekend attendance records that were created by the sandwich rule

### Workflow

**When Creating/Updating to Absent:**
1. Employee attendance is created/updated with status "absent"
2. System checks the day of the week:
   - If **Friday**: Check if Monday is also absent
   - If **Monday**: Check if Friday is also absent
3. If both conditions are met:
   - Create/update Saturday attendance as absent
   - Create/update Sunday attendance as absent
   - Add explanatory note to the records

**When Updating from Absent to Present:**
1. Employee attendance is updated from "absent" to another status (e.g., "present")
2. System checks the day of the week:
   - If **Friday** or **Monday**: Check weekend records
3. If weekend records have "Sandwich rule applied" in notes:
   - Delete those weekend attendance records
   - Preserve any manually created weekend records

## Notes
- The sandwich rule only applies to "absent" status
- **The sandwich rule does NOT apply if Friday or Monday has an approved leave**
- Leave days are not affected by this rule
- Weekend records created by the sandwich rule are automatically removed if Friday or Monday status changes
- Manually created weekend attendance records are preserved (not affected by the removal logic)
- The rule works bidirectionally (marking Friday or Monday as absent will trigger the check)
- The system uses the notes field to track which records were created by the sandwich rule
- The system checks the leave application table for approved leaves before applying the sandwich rule
