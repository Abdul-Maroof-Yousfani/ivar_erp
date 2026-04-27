"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Eye, Pencil, Trash2, Loader2, FileText } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteIncrement, getIncrementById, type Increment } from "@/lib/actions/increment";
import { toast } from "sonner";
import { format } from "date-fns";

// Function to generate increment letter HTML
function generateIncrementLetter(increment: Increment): string {
  const employeeName = increment.employeeName || "Employee";
  const designation = increment.designationName || "Employee";
  const letterDate = format(new Date(), "dd-MMM-yyyy");
  const effectiveDate = format(new Date(increment.promotionDate), "dd-MMM-yyyy");
  
  // Calculate previous salary (current salary - increment)
  const currentSalary = increment.salary;
  const incrementValue = increment.incrementMethod === "Amount" 
    ? (increment.incrementAmount || 0)
    : (increment.incrementPercentage || 0);
  
  let previousSalary = currentSalary;
  let incrementAmount = 0;
  
  if (increment.incrementMethod === "Amount") {
    incrementAmount = increment.incrementType === "Increment" ? incrementValue : -incrementValue;
    previousSalary = currentSalary - incrementAmount;
  } else {
    // Percentage
    const percentage = incrementValue / 100;
    incrementAmount = increment.incrementType === "Increment" 
      ? currentSalary * percentage / (1 + percentage)
      : -currentSalary * percentage / (1 - percentage);
    previousSalary = currentSalary - incrementAmount;
  }
  
  const incrementDisplay = increment.incrementType === "Increment" 
    ? `Rs. ${Math.abs(incrementAmount).toLocaleString()}/-`
    : `Rs. -${Math.abs(incrementAmount).toLocaleString()}/-`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Salary Increment Letter</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 40px;
      line-height: 1.6;
      color: #000;
    }
    .header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .employee-info {
      font-size: 14px;
    }
    .date {
      font-size: 14px;
      text-align: right;
    }
    h1 {
      text-align: center;
      text-decoration: underline;
      font-size: 20px;
      font-weight: bold;
      margin: 30px 0;
      text-transform: uppercase;
    }
    .salutation {
      margin-top: 20px;
      margin-bottom: 15px;
    }
    .body-text {
      margin-bottom: 15px;
      text-align: justify;
    }
    .salary-table {
      margin: 25px 0;
      width: 100%;
      border-collapse: collapse;
    }
    .salary-table th,
    .salary-table td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    .salary-table th {
      font-weight: bold;
      width: 50%;
    }
    .salary-table td {
      font-weight: bold;
    }
    .confidentiality {
      margin-top: 20px;
      font-size: 12px;
      font-style: italic;
    }
    .closing {
      margin-top: 30px;
    }
    .signature {
      margin-top: 40px;
    }
    @media print {
      body {
        margin: 0;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="employee-info">
      <div><strong>${employeeName}</strong></div>
      <div>${designation}</div>
    </div>
    <div class="date">${letterDate}</div>
  </div>

  <h1>SALARY INCREMENT</h1>

  <div class="salutation">
    <p>Dear ${employeeName},</p>
  </div>

  <div class="body-text">
    <p>
      The management has reviewed your performance and has acknowledged your achievements with great appreciation.
      We are pleased to inform you that you have been awarded a salary ${increment.incrementType === "Increment" ? "increase" : "adjustment"} of <strong>${incrementDisplay}</strong>.
      Therefore, your revised monthly salary with effect from ${effectiveDate} is <strong>Rs. ${currentSalary.toLocaleString()}/-</strong>.
    </p>
  </div>

  <p><strong>Following are the details of your updated package:</strong></p>

  <table class="salary-table">
    <tr>
      <th>Previous Salary</th>
      <td>Rs. ${previousSalary.toLocaleString()}</td>
    </tr>
    <tr>
      <th>Increment</th>
      <td>Rs. ${incrementAmount >= 0 ? '' : '-'}${Math.abs(incrementAmount).toLocaleString()}</td>
    </tr>
    <tr>
      <th>Revised Salary</th>
      <td>Rs. ${currentSalary.toLocaleString()}</td>
    </tr>
  </table>

  <div class="confidentiality">
    <p>Your salary information is highly confidential. Disciplinary action shall be taken in case of disclosure.</p>
  </div>

  <div class="closing">
    <p>We thank you for your efforts and contributions and hope that you will continue to provide the same level of motivation going forward.</p>
  </div>

  <div class="signature">
    <p>Sincerely,</p>
  </div>
</body>
</html>
  `;
}

export interface IncrementRow {
  id: string;
  sNo: number;
  empId: string;
  empName: string;
  department: string;
  subDepartment: string;
  designation: string;
  increment: string;
  decrement: string;
  salary: string;
  date: string;
  status: string;
}

export const columns: ColumnDef<IncrementRow>[] = [
  {
    accessorKey: "sNo",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        S.No
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium text-muted-foreground w-8">
        {row.original.sNo}
      </div>
    ),
    size: 60,
  },
  {
    accessorKey: "employee",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Emp ID
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.empId}</div>
    ),
    size: 100,
  },
  {
    accessorKey: "empName",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Emp Name
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.empName}</div>
    ),
    size: 150,
  },
  {
    accessorKey: "departmentInfo",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Dept / Subdept
      </div>
    ),
    cell: ({ row }) => (
      <div className="space-y-1">
        <div className="text-sm">{row.original.department || "-"}</div>
        <div className="text-sm text-muted-foreground">{row.original.subDepartment || "-"}</div>
      </div>
    ),
    size: 200,
  },
  {
    accessorKey: "designation",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Designation
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.designation}</div>
    ),
    size: 180,
  },
  {
    accessorKey: "increment",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Increment
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium text-green-600">
        {row.original.increment || "-"}
      </div>
    ),
    size: 120,
  },
  {
    accessorKey: "decrement",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Decrement
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium text-red-600">
        {row.original.decrement || "-"}
      </div>
    ),
    size: 120,
  },
  {
    accessorKey: "salary",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Salary
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.salary}</div>
    ),
    size: 120,
  },
  {
    accessorKey: "date",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Date
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.date}</div>
    ),
    size: 120,
  },
  {
    accessorKey: "status",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Status
      </div>
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      const variant =
        status === "Active" || status === "Approved"
          ? "default"
          : status === "Pending"
          ? "secondary"
          : "destructive";
      return (
        <Badge variant={variant} className="font-medium">
          {status}
        </Badge>
      );
    },
    size: 100,
  },
  {
    id: "download",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Download
      </div>
    ),
    cell: ({ row }) => {
      const [isDownloading, setIsDownloading] = useState(false);

      const handleDownload = async () => {
        try {
          setIsDownloading(true);
          const result = await getIncrementById(row.original.id);
          
          if (!result.status || !result.data) {
            toast.error("Failed to fetch increment details");
            return;
          }

          const increment = result.data;
          
          // Generate increment letter HTML
          const letterHTML = generateIncrementLetter(increment);
          
          // Create a blob and download
          const blob = new Blob([letterHTML], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          
          // Open in new tab first (browser will display the HTML)
          const newWindow = window.open(url, '_blank');
          
          // Create a temporary link and trigger download
          const link = document.createElement('a');
          link.href = url;
          link.download = `Increment_Letter_${increment.employeeName || increment.employeeId}_${format(new Date(increment.promotionDate), 'dd-MMM-yyyy')}.html`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up after a delay to ensure download and window open complete
          setTimeout(() => {
            URL.revokeObjectURL(url);
          }, 1000);
          
          toast.success("Increment letter downloaded successfully");
        } catch (error) {
          console.error("Error downloading increment letter:", error);
          toast.error("Failed to download increment letter");
        } finally {
          setIsDownloading(false);
        }
      };

      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 text-destructive animate-spin" />
          ) : (
            <FileText className="h-4 w-4 text-destructive" />
          )}
        </Button>
      );
    },
    size: 100,
  },
  {
    id: "actions",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
        Actions
      </div>
    ),
    cell: ({ row }) => {
      const [deleteDialog, setDeleteDialog] = useState(false);
      const [isPending, startTransition] = useTransition();
      const router = useRouter();

      const handleDelete = () => {
        startTransition(async () => {
          try {
            const result = await deleteIncrement(row.original.id);
            if (result.status) {
              toast.success(result.message || "Increment deleted successfully");
              router.refresh();
              setDeleteDialog(false);
            } else {
              toast.error(result.message || "Failed to delete increment");
            }
          } catch (error) {
            console.error("Error deleting increment:", error);
            toast.error("Failed to delete increment");
          }
        });
      };

      return (
        <>
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/hr/payroll-setup/increment/view/${row.original.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/hr/payroll-setup/increment/edit/${row.original.id}`}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Increment</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this increment for{" "}
                  <strong>{row.original.empName}</strong>? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    },
    size: 100,
  },
];

