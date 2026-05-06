# Sandwich Rule Fix: Approved Leave Exception

## Problem Statement (Roman Urdu)
Jab employee ne Friday aur Monday ki leave apply ki hui hai aur wo **approved** bhi hai, to sandwich rule weekend (Saturday-Sunday) ko absent mark kar raha tha. Ye galat hai kyunke approved leaves legitimate hain aur unhe penalize nahi karna chahiye.

## Problem Statement (English)
When an employee had applied and received **approved** leave for Friday and Monday, the sandwich rule was still marking the weekend (Saturday-Sunday) as absent. This is incorrect because approved leaves are legitimate and should not be penalized.

## Solution Implemented

### Code Changes
**File:** `nestjs_backend/src/attendance/attendance.service.ts`

#### 1. Added New Method: `hasApprovedLeaveOnDates()`
```typescript
private async hasApprovedLeaveOnDates(
  employeeId: string,
  friday: Date,
  monday: Date,
): Promise<boolean>
```

This method checks if there's any approved leave application that covers the Friday-to-Monday period.

#### 2. Updated `applySandwichRule()` Method
Added approved leave check before applying sandwich rule:

**Before:**
- Only checked if Friday AND Monday are both absent
- Applied sandwich rule immediately

**After:**
- Checks if Friday AND Monday are both absent
- **NEW:** Checks if there's any approved leave covering Friday or Monday
- Only applies sandwich rule if NO approved leave exists

### Logic Flow

```
Employee absent on Friday + Monday
    ↓
Check: Is there an approved leave?
    ↓
YES → Do NOT apply sandwich rule (weekend stays normal)
    ↓
NO → Apply sandwich rule (mark weekend as absent)
```

## Testing

### Test Scenario 1: Approved Leave (Should NOT Apply Sandwich)
**Setup:**
- Friday (Apr 17): Absent with approved leave
- Monday (Apr 21): Absent with approved leave

**Expected Result:**
- Saturday (Apr 18): No sandwich rule applied
- Sunday (Apr 19): No sandwich rule applied

### Test Scenario 2: No Approved Leave (Should Apply Sandwich)
**Setup:**
- Friday (Apr 17): Absent without approved leave
- Monday (Apr 21): Absent without approved leave

**Expected Result:**
- Saturday (Apr 18): Marked absent by sandwich rule
- Sunday (Apr 19): Marked absent by sandwich rule

### Test Script
Use the SQL script: `nestjs_backend/scripts/test-sandwich-with-approved-leave.sql`

## Documentation Updates

### Files Updated:
1. `documentation/attendance-sandwich-system.md`
   - Added "Important Exception: Approved Leaves" section
   - Added new scenario example
   - Updated notes section

2. `documentation/attendance-sandwich-system-urdu.md`
   - Added "Zaroori Exception: Approved Leaves" section (Roman Urdu)
   - Added new example
   - Updated important points

## Database Query
The fix uses this query to check for approved leaves:

```sql
SELECT * FROM leave_application
WHERE employeeId = ?
  AND status = 'approved'
  AND fromDate <= monday_date
  AND toDate >= friday_date
```

## Impact

### Positive Impact:
- ✅ Employees with approved leaves are not penalized
- ✅ Fair treatment of legitimate leave applications
- ✅ Sandwich rule only applies to unauthorized absences
- ✅ Better employee satisfaction

### No Negative Impact:
- ✅ Existing sandwich rule logic for unauthorized absences still works
- ✅ No breaking changes to existing functionality
- ✅ Performance impact minimal (one additional query)

## Deployment Notes

1. No database migration required
2. No configuration changes needed
3. Backward compatible with existing data
4. Can be deployed immediately

## Future Considerations

- Consider adding a setting to enable/disable approved leave exception
- Add audit logging for sandwich rule decisions
- Consider partial leave scenarios (half-day leaves)
