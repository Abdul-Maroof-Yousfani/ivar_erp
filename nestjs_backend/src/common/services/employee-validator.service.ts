import { Injectable, Logger } from '@nestjs/common';
import { ParsedRecord } from './csv-parser.service';

export interface ValidationError {
    row: number;
    field: string;
    value: any;
    reason: string;
    employeeId?: string;
    employeeName?: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

@Injectable()
export class EmployeeValidatorService {
    private readonly logger = new Logger(EmployeeValidatorService.name);

    /**
     * Validate a single employee record
     */
    validateRecord(record: ParsedRecord): ValidationResult {
        const errors: ValidationError[] = [];
        const { row, data } = record;

        // Reference fields for traceability
        const employeeId = data.employeeId || data.employeeID || data['Employee ID'] || data['EmployeeID'];
        const employeeName = data.employeeName || data['Employee Name'] || data.name;

        const err = (field: string, value: any, reason: string): ValidationError =>
            ({ row, field, value, reason, employeeId, employeeName });

        // 5. Date Validation (optional fields - only validate format if provided)
        const joiningDate = data.joiningDate || data['Joining Date'] || data['Joining-Date'];
        if (joiningDate && !this.isValidDate(joiningDate)) {
            errors.push(err('JoiningDate', joiningDate, 'Invalid Joining Date format. Use YYYY-MM-DD or DD-MM-YYYY.'));
        }

        const dob = data.dateOfBirth || data['Date of Birth'] || data['Date-Of-Birth'];
        if (dob && !this.isValidDate(dob)) {
            errors.push(err('DateOfBirth', dob, 'Invalid Date of Birth format.'));
        }

        // 6. Salary Validation (only validate format if provided)
        const salary = data.employeeSalary ?? data['Employee Salary'] ?? data['employee_salary'] ?? data['EmployeeSalary'] ?? data['Salary'] ?? data.salary ?? data['salary'];
        if (salary !== undefined && salary !== null && salary !== '') {
            const cleaned = String(salary).replace(/,/g, '').trim();
            const numSalary = Number(cleaned);
            if (isNaN(numSalary)) {
                errors.push(err('EmployeeSalary', salary, 'Employee Salary must be a valid number.'));
            } else if (numSalary < 0) {
                errors.push(err('EmployeeSalary', salary, 'Employee Salary cannot be negative.'));
            }
        }
        
        // 7. Qualification Fields Validation (only validate format if provided)
        const passingYear = data.passingYear || data['Passing Year'];
        if (passingYear && isNaN(Number(passingYear))) {
            errors.push(err('PassingYear', passingYear, 'Passing Year must be a valid number.'));
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Validate a batch of records
     */
    validateRecords(records: ParsedRecord[]): ValidationError[] {
        const errors: ValidationError[] = [];
        for (const record of records) {
            const result = this.validateRecord(record);
            if (!result.isValid) {
                errors.push(...result.errors);
            }
        }
        return errors;
    }

    /**
     * Helper to validate date string
     */
    private isValidDate(dateStr: any): boolean {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return true;

        // Check common formats manually if Date() fails
        if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateStr)) return true; // DD-MM-YYYY
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) return true; // MM/DD/YYYY

        return false;
    }

    /**
     * Check for duplicates within the file
     */
    checkInternalDuplicates(records: ParsedRecord[]): ValidationError[] {
        const errors: ValidationError[] = [];
        const empIdMap = new Map<string, number[]>();
        const cnicMap = new Map<string, number[]>();
        const emailMap = new Map<string, number[]>();

        records.forEach((record) => {
            const data = record.data;
            const empId = data.employeeId || data.employeeID || data['Employee ID'] || data['EmployeeID'];
            const cnic = data.cnicNumber || data['CNIC Number'] || data['CNIC-Number'];
            const email = data.officialEmail || data['Official Email'] || data['Offcial-Email'];

            if (empId) {
                const norm = String(empId).trim().toLowerCase();
                empIdMap.set(norm, [...(empIdMap.get(norm) || []), record.row]);
            }
            if (cnic) {
                const norm = String(cnic).trim().toLowerCase().replace(/[^0-9]/g, '');
                cnicMap.set(norm, [...(cnicMap.get(norm) || []), record.row]);
            }
            if (email) {
                const norm = String(email).trim().toLowerCase();
                emailMap.set(norm, [...(emailMap.get(norm) || []), record.row]);
            }
        });

        const reportDup = (map: Map<string, number[]>, field: string) => {
            map.forEach((rows, value) => {
                if (rows.length > 1) {
                    rows.forEach(row => {
                        errors.push({
                            row,
                            field,
                            value,
                            reason: `Duplicate ${field} found in file (rows: ${rows.join(', ')})`
                        });
                    });
                }
            });
        };

        reportDup(empIdMap, 'EmployeeID');
        reportDup(cnicMap, 'CNICNumber');
        reportDup(emailMap, 'OfficialEmail');

        return errors;
    }
}
