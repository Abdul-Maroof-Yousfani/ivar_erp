# Sandwich Deduction Control - Implementation Guide

## Overview
HR Admin ko control dena ke sandwich rule ki deduction apply karni hai ya nahi per-employee basis par payroll preview mein.

## Current Implementation Status

### ✅ Already Implemented
1. **Backend tracking**: Sandwich absences ko separately track kiya ja raha hai
2. **Attendance breakup**: `sandwichAbsent` field added with count and amount
3. **Data structure**: Preview data mein sandwich information available hai

### 📋 Implementation Options

## **Option 1: Simple Checkbox in Preview (Recommended)**

### Frontend Changes Required

**File**: `frontend/app/hr/payroll-setup/payroll/create/client.tsx`

#### Step 1: Add State for Sandwich Deduction Control
```typescript
// Add after previewData state
const [sandwichDeductionEnabled, setSandwichDeductionEnabled] = useState<Record<string, boolean>>({});
```

#### Step 2: Initialize Sandwich Deduction State
```typescript
// When preview data loads, initialize all as enabled (default)
useEffect(() => {
    if (previewData.length > 0) {
        const initialState: Record<string, boolean> = {};
        previewData.forEach(row => {
            initialState[row.employeeId] = true; // Default: enabled
        });
        setSandwichDeductionEnabled(initialState);
    }
}, [previewData]);
```

#### Step 3: Add Checkbox in Deductions Column
In the deductions cell (around line 540), add:

```typescript
<TableCell>
    <div className="text-[10px] space-y-0.5 min-w-[160px]">
        {/* Existing deductions... */}
        
        {/* Attendance Deduction with Sandwich Control */}
        <div className="space-y-1">
            <div className="flex justify-between items-center gap-2">
                <span className="font-bold shrink-0">Attendance:</span>
                <span className="text-right">
                    {Math.round(Number(row.attendanceDeduction || 0)).toLocaleString()}
                </span>
            </div>
            
            {/* Show sandwich breakdown if exists */}
            {row.attendanceBreakup?.sandwichAbsent?.count > 0 && (
                <div className="ml-2 p-2 bg-amber-50 border border-amber-200 rounded">
                    <div className="flex items-center gap-2 mb-1">
                        <input
                            type="checkbox"
                            id={`sandwich-${row.employeeId}`}
                            checked={sandwichDeductionEnabled[row.employeeId] ?? true}
                            onChange={(e) => {
                                setSandwichDeductionEnabled(prev => ({
                                    ...prev,
                                    [row.employeeId]: e.target.checked
                                }));
                                // Recalculate deduction
                                handleSandwichToggle(index, e.target.checked);
                            }}
                            className="w-3 h-3"
                        />
                        <label 
                            htmlFor={`sandwich-${row.employeeId}`}
                            className="text-[9px] font-semibold text-amber-700 cursor-pointer"
                        >
                            Apply Sandwich Deduction
                        </label>
                    </div>
                    <div className="text-[9px] text-amber-600 space-y-0.5">
                        <div className="flex justify-between">
                            <span>Regular Absent:</span>
                            <span>{row.attendanceBreakup.absent.count} days</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Sandwich Absent:</span>
                            <span>{row.attendanceBreakup.sandwichAbsent.count} days</span>
                        </div>
                        <div className="flex justify-between font-bold border-t border-amber-300 pt-0.5">
                            <span>Sandwich Amount:</span>
                            <span>
                                {sandwichDeductionEnabled[row.employeeId] 
                                    ? Math.round(row.attendanceBreakup.sandwichAbsent.amount).toLocaleString()
                                    : '0 (Waived)'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
        
        {/* Rest of deductions... */}
    </div>
</TableCell>
```

#### Step 4: Add Handler Function
```typescript
const handleSandwichToggle = (index: number, enabled: boolean) => {
    const updatedData = [...previewData];
    const row = updatedData[index];
    
    if (row.attendanceBreakup?.sandwichAbsent) {
        const sandwichAmount = enabled ? row.attendanceBreakup.sandwichAbsent.amount : 0;
        const regularAmount = row.attendanceBreakup.absent.amount;
        
        // Update attendance deduction
        row.attendanceDeduction = regularAmount + sandwichAmount;
        
        // Recalculate net salary
        const totalDed = 
            row.attendanceDeduction +
            row.totalDeductions + 
            row.taxDeduction + 
            row.loanDeduction + 
            row.advanceSalaryDeduction + 
            row.eobiDeduction + 
            row.providentFundDeduction;
        
        row.netSalary = row.grossSalary - totalDed;
        
        setPreviewData(updatedData);
    }
};
```

#### Step 5: Pass Sandwich Decision to Confirm
Update the confirm handler to include sandwich deduction decisions:

```typescript
const handleConfirm = async () => {
    startTransition(async () => {
        try {
            // Add sandwich deduction info to each detail
            const detailsWithSandwich = previewData.map(row => ({
                ...row,
                applySandwichDeduction: sandwichDeductionEnabled[row.employeeId] ?? true,
            }));
            
            const result = await confirmPayroll({
                month: formData.monthYear.split("-")[1],
                year: formData.monthYear.split("-")[0],
                generatedBy: currentUserId,
                details: detailsWithSandwich,
            });
            
            // ... rest of confirm logic
        } catch (error) {
            // ... error handling
        }
    });
};
```

### Backend Changes (Optional - for record keeping)

**File**: `nestjs_backend/src/payroll/payroll.service.ts`

Add a field in payroll detail to store the decision:

```typescript
// In confirmPayroll method, when creating payrollDetail:
await this.prisma.payrollDetail.create({
    data: {
        // ... existing fields
        applySandwichDeduction: detail.applySandwichDeduction ?? true,
        sandwichAbsentDays: detail.attendanceBreakup?.sandwichAbsent?.count || 0,
        sandwichDeductionAmount: detail.applySandwichDeduction 
            ? detail.attendanceBreakup?.sandwichAbsent?.amount || 0 
            : 0,
        // ... rest of fields
    }
});
```

## **Option 2: Global Setting (Simpler but Less Flexible)**

### Implementation

**File**: Create a new settings table or use existing settings

```sql
-- Add to settings or create attendance_settings table
ALTER TABLE company_settings ADD COLUMN enable_sandwich_deduction BOOLEAN DEFAULT true;
```

**Frontend**: Add toggle in Settings → Attendance Policy
**Backend**: Check this setting before applying sandwich deduction

### Pros & Cons

**Option 1 (Per-Employee Control)**:
- ✅ Maximum flexibility
- ✅ Case-by-case decisions
- ✅ Visible in payroll preview
- ❌ More UI changes

**Option 2 (Global Setting)**:
- ✅ Simple implementation
- ✅ One-time decision
- ❌ No per-employee control
- ❌ Less flexible

## Recommended: **Option 1**

Kyunki:
1. HR ko har employee ke liye alag decision lene ki zaroorat ho sakti hai
2. Special cases handle kar sakte hain (medical leave, emergency, etc.)
3. Payroll preview mein hi control hai - fast decision making
4. Transparent - HR dekh sakta hai kitne paise kat rahe hain

## Testing Checklist

- [ ] Checkbox shows only when sandwich absences exist
- [ ] Unchecking removes sandwich deduction from total
- [ ] Net salary recalculates correctly
- [ ] Confirm payroll saves the decision
- [ ] Payroll report shows correct deduction
- [ ] Multiple employees can have different settings
- [ ] Default is enabled (sandwich deduction applied)

## UI Mockup

```
Deductions Column:
┌─────────────────────────────┐
│ PF: 1,524                   │
│ Advance: 0                  │
│ EOBI: 0                     │
│ Loan: 0                     │
│                             │
│ Attendance: 6,000           │
│ ┌─────────────────────────┐ │
│ │ ☑ Apply Sandwich Ded.   │ │
│ │ Regular Absent: 2 days  │ │
│ │ Sandwich Absent: 2 days │ │
│ │ Sandwich Amount: 3,000  │ │
│ └─────────────────────────┘ │
│                             │
│ Total: 6,924                │
└─────────────────────────────┘
```

## Notes

- Sandwich deduction by default **enabled** hai
- HR manually uncheck kar sakta hai specific employees ke liye
- Decision payroll record mein save hoga for audit trail
- Reports mein dono amounts show honge (with/without sandwich)
