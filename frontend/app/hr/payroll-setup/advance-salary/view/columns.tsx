"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MoreHorizontal, CheckCircle2, XCircle, Edit2, Trash2, Eye, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  approveAdvanceSalary,
  rejectAdvanceSalary,
  deleteAdvanceSalary,
  getAdvanceSalaryById,
  updateAdvanceSalary,
  type AdvanceSalary,
} from "@/lib/actions/advance-salary";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { useAuth } from "@/components/providers/auth-provider";

export interface AdvanceSalaryRow {
  id: string;
  sNo: number;
  empId: string;
  empName: string;
  amountNeeded: number;
  salaryNeedOn: string;
  deductionMonthYear: string;
  approval1: string;
  status: string;
  createdById?: string;
}

// Edit form schema
const editAdvanceSalarySchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      "Amount must be a positive number"
    ),
  neededOn: z
    .string()
    .min(1, "Advance salary needed date is required"),
  deductionMonthYear: z
    .string()
    .min(1, "Deduction month and year is required")
    .regex(/^\d{4}-\d{2}$/, "Invalid month-year format"),
  reason: z
    .string()
    .min(1, "Reason is required")
    .min(10, "Reason must be at least 10 characters")
    .max(500, "Reason must not exceed 500 characters"),
});

type EditAdvanceSalaryFormData = z.infer<typeof editAdvanceSalarySchema>;

function RowActions({ row }: { row: { original: AdvanceSalaryRow } }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [advanceSalaryDetails, setAdvanceSalaryDetails] = useState<AdvanceSalary | null>(null);
  const { hasPermission, user } = useAuth();
  const canApprove = hasPermission("hr.advance-salary.approve");
  const canEdit = hasPermission("hr.advance-salary.update");
  const canDelete = hasPermission("hr.advance-salary.delete");
  const canRead = hasPermission("hr.advance-salary.read");

  const [loadingDetails, setLoadingDetails] = useState(false);
  const record = row.original;

  // Check if current user created this request
  const isCreatedByCurrentUser = record.createdById === user?.id;

  const form = useForm<EditAdvanceSalaryFormData>({
    resolver: zodResolver(editAdvanceSalarySchema) as any,
    defaultValues: {
      amount: "",
      neededOn: "",
      deductionMonthYear: "",
      reason: "",
    },
    mode: "onBlur",
  });

  // Load advance salary details for view
  useEffect(() => {
    if (viewDialog && !advanceSalaryDetails) {
      setLoadingDetails(true);
      getAdvanceSalaryById(record.id).then((res) => {
        if (res.status && res.data) {
          setAdvanceSalaryDetails(res.data);
        } else {
          toast.error(res.message || "Failed to load advance salary details");
          setViewDialog(false);
        }
        setLoadingDetails(false);
      });
    }
  }, [viewDialog, record.id, advanceSalaryDetails]);

  // Load advance salary details for edit
  useEffect(() => {
    if (editDialog) {
      setLoadingDetails(true);
      getAdvanceSalaryById(record.id).then((res) => {
        if (res.status && res.data) {
          const data = res.data;
          setAdvanceSalaryDetails(data);
          form.reset({
            amount: typeof data.amount === 'string' ? data.amount : data.amount.toString(),
            neededOn: data.neededOn,
            deductionMonthYear: data.deductionMonthYear,
            reason: data.reason,
          });
        } else {
          toast.error(res.message || "Failed to load advance salary details");
          setEditDialog(false);
        }
        setLoadingDetails(false);
      });
    }
  }, [editDialog, record.id, form]);

  const handleApprove = async () => {
    startTransition(async () => {
      const result = await approveAdvanceSalary(record.id);
      if (result.status) {
        toast.success(result.message || "Advance salary approved successfully");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to approve advance salary");
      }
    });
  };

  const handleReject = async () => {
    startTransition(async () => {
      const result = await rejectAdvanceSalary(record.id);
      if (result.status) {
        toast.success(result.message || "Advance salary rejected successfully");
        setRejectDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to reject advance salary");
      }
    });
  };

  const handleDelete = async () => {
    startTransition(async () => {
      const result = await deleteAdvanceSalary(record.id);
      if (result.status) {
        toast.success(result.message || "Advance salary deleted successfully");
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete advance salary");
      }
    });
  };

  const handleEditSubmit = async (data: EditAdvanceSalaryFormData) => {
    startTransition(async () => {
      const result = await updateAdvanceSalary(record.id, {
        amount: parseFloat(data.amount),
        neededOn: data.neededOn,
        deductionMonthYear: data.deductionMonthYear,
        reason: data.reason,
      });
      if (result.status) {
        toast.success(result.message || "Advance salary updated successfully");
        setEditDialog(false);
        setAdvanceSalaryDetails(null);
        form.reset();
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update advance salary");
      }
    });
  };

  const handlePrint = () => {
    if (!advanceSalaryDetails) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Advance Salary Request - ${advanceSalaryDetails.employee?.employeeName || record.empName}</title>
          <style>
            @media print {
              @page { margin: 20mm; }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #000;
              padding-bottom: 20px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .info-section {
              margin-bottom: 25px;
            }
            .info-section h2 {
              font-size: 18px;
              margin-bottom: 15px;
              border-bottom: 1px solid #ccc;
              padding-bottom: 5px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 15px;
            }
            .info-item {
              margin-bottom: 10px;
            }
            .info-label {
              font-weight: bold;
              color: #666;
              font-size: 12px;
              text-transform: uppercase;
              margin-bottom: 3px;
            }
            .info-value {
              font-size: 14px;
            }
            .reason-box {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 5px;
              margin-top: 10px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ccc;
              font-size: 12px;
              color: #666;
            }
            .badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
            }
            .badge-approved {
              background: #10b981;
              color: white;
            }
            .badge-pending {
              background: #6b7280;
              color: white;
            }
            .badge-rejected {
              background: #ef4444;
              color: white;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Advance Salary Request</h1>
            <p>Generated on ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}</p>
          </div>

          <div class="info-section">
            <h2>Employee Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Employee ID</div>
                <div class="info-value">${advanceSalaryDetails.employee?.employeeId || record.empId}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Employee Name</div>
                <div class="info-value">${advanceSalaryDetails.employee?.employeeName || record.empName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Department</div>
                <div class="info-value">${advanceSalaryDetails.employee?.department?.name || "—"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Sub Department</div>
                <div class="info-value">${advanceSalaryDetails.employee?.subDepartment?.name || "—"}</div>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h2>Advance Salary Details</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Amount</div>
                <div class="info-value">${new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(typeof advanceSalaryDetails.amount === 'string' ? parseFloat(advanceSalaryDetails.amount) : advanceSalaryDetails.amount)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Needed On</div>
                <div class="info-value">${format(new Date(advanceSalaryDetails.neededOn), "MMMM dd, yyyy")}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Deduction Month & Year</div>
                <div class="info-value">${format(new Date(`${advanceSalaryDetails.deductionMonthYear}-01`), "MMMM yyyy")}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">
                  <span class="badge badge-${advanceSalaryDetails.status === 'active' ? 'approved' : advanceSalaryDetails.status === 'pending' ? 'pending' : 'rejected'}">
                    ${advanceSalaryDetails.status}
                  </span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">Approval Status</div>
                <div class="info-value">
                  <span class="badge badge-${advanceSalaryDetails.approvalStatus === 'approved' ? 'approved' : advanceSalaryDetails.approvalStatus === 'pending' ? 'pending' : 'rejected'}">
                    ${advanceSalaryDetails.approvalStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h2>Reason</h2>
            <div class="reason-box">
              ${advanceSalaryDetails.reason}
            </div>
          </div>

          ${advanceSalaryDetails.rejectionReason ? `
          <div class="info-section">
            <h2>Rejection Reason</h2>
            <div class="reason-box">
              ${advanceSalaryDetails.rejectionReason}
            </div>
          </div>
          ` : ''}

          <div class="info-section">
            <h2>Audit Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Created By</div>
                <div class="info-value">${advanceSalaryDetails.createdBy ? `${advanceSalaryDetails.createdBy.firstName} ${advanceSalaryDetails.createdBy.lastName}` : "—"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Created At</div>
                <div class="info-value">${format(new Date(advanceSalaryDetails.createdAt), "MMMM dd, yyyy 'at' hh:mm a")}</div>
              </div>
              ${advanceSalaryDetails.approvedBy ? `
              <div class="info-item">
                <div class="info-label">Approved By</div>
                <div class="info-value">${advanceSalaryDetails.approvedBy.firstName} ${advanceSalaryDetails.approvedBy.lastName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Approved At</div>
                <div class="info-value">${advanceSalaryDetails.approvedAt ? format(new Date(advanceSalaryDetails.approvedAt), "MMMM dd, yyyy 'at' hh:mm a") : "—"}</div>
              </div>
              ` : ''}
            </div>
          </div>

          <div class="footer">
            <p>This is a system-generated document.</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleViewClose = () => {
    setViewDialog(false);
    setAdvanceSalaryDetails(null);
  };

  const handleEditClose = () => {
    setEditDialog(false);
    setAdvanceSalaryDetails(null);
    form.reset();
  };

  const isPendingApproval = record.approval1 === "Pending";
  const isApproved = record.approval1 === "Approved";
  const isRejected = record.approval1 === "Rejected";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {isPendingApproval && (
            <>
              <DropdownMenuItem
                onClick={handleApprove}
                disabled={isPending || !canApprove || isCreatedByCurrentUser}
                className="text-green-600 focus:text-green-600"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setRejectDialog(true)}
                disabled={isPending || !canApprove || isCreatedByCurrentUser}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {isApproved && (
            <DropdownMenuItem disabled className="text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Already Approved
            </DropdownMenuItem>
          )}

          {isRejected && (
            <DropdownMenuItem disabled className="text-muted-foreground">
              <XCircle className="h-4 w-4 mr-2" />
              Already Rejected
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            onClick={() => setViewDialog(true)}
            disabled={isPending}
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setEditDialog(true)}
            disabled={isPending || isApproved || !canEdit}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={async () => {
              let details = advanceSalaryDetails;
              if (!details) {
                setLoadingDetails(true);
                const res = await getAdvanceSalaryById(record.id);
                if (res.status && res.data) {
                  details = res.data;
                  setAdvanceSalaryDetails(details);
                } else {
                  toast.error("Failed to load details for printing");
                  setLoadingDetails(false);
                  return;
                }
                setLoadingDetails(false);
              }

              // Use the details to print
              if (details) {
                const printWindow = window.open('', '_blank');
                if (!printWindow) {
                  toast.error("Please allow popups to print");
                  return;
                }

                const printContent = `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>Advance Salary Request - ${details.employee?.employeeName || record.empName}</title>
                      <style>
                        @media print {
                          @page { margin: 20mm; }
                        }
                        body {
                          font-family: Arial, sans-serif;
                          padding: 20px;
                          max-width: 800px;
                          margin: 0 auto;
                        }
                        .header {
                          text-align: center;
                          margin-bottom: 30px;
                          border-bottom: 2px solid #000;
                          padding-bottom: 20px;
                        }
                        .header h1 {
                          margin: 0;
                          font-size: 24px;
                        }
                        .info-section {
                          margin-bottom: 25px;
                        }
                        .info-section h2 {
                          font-size: 18px;
                          margin-bottom: 15px;
                          border-bottom: 1px solid #ccc;
                          padding-bottom: 5px;
                        }
                        .info-grid {
                          display: grid;
                          grid-template-columns: 1fr 1fr;
                          gap: 15px;
                          margin-bottom: 15px;
                        }
                        .info-item {
                          margin-bottom: 10px;
                        }
                        .info-label {
                          font-weight: bold;
                          color: #666;
                          font-size: 12px;
                          text-transform: uppercase;
                          margin-bottom: 3px;
                        }
                        .info-value {
                          font-size: 14px;
                        }
                        .reason-box {
                          background: #f5f5f5;
                          padding: 15px;
                          border-radius: 5px;
                          margin-top: 10px;
                        }
                        .footer {
                          margin-top: 40px;
                          padding-top: 20px;
                          border-top: 1px solid #ccc;
                          font-size: 12px;
                          color: #666;
                        }
                        .badge {
                          display: inline-block;
                          padding: 4px 12px;
                          border-radius: 4px;
                          font-size: 12px;
                          font-weight: bold;
                        }
                        .badge-approved {
                          background: #10b981;
                          color: white;
                        }
                        .badge-pending {
                          background: #6b7280;
                          color: white;
                        }
                        .badge-rejected {
                          background: #ef4444;
                          color: white;
                        }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <h1>Advance Salary Request</h1>
                        <p>Generated on ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}</p>
                      </div>

                      <div class="info-section">
                        <h2>Employee Information</h2>
                        <div class="info-grid">
                          <div class="info-item">
                            <div class="info-label">Employee ID</div>
                            <div class="info-value">${details.employee?.employeeId || record.empId}</div>
                          </div>
                          <div class="info-item">
                            <div class="info-label">Employee Name</div>
                            <div class="info-value">${details.employee?.employeeName || record.empName}</div>
                          </div>
                          <div class="info-item">
                            <div class="info-label">Department</div>
                            <div class="info-value">${details.employee?.department?.name || "—"}</div>
                          </div>
                          <div class="info-item">
                            <div class="info-label">Sub Department</div>
                            <div class="info-value">${details.employee?.subDepartment?.name || "—"}</div>
                          </div>
                        </div>
                      </div>

                      <div class="info-section">
                        <h2>Advance Salary Details</h2>
                        <div class="info-grid">
                          <div class="info-item">
                            <div class="info-label">Amount</div>
                            <div class="info-value">${new Intl.NumberFormat("en-PK", {
                  style: "currency",
                  currency: "PKR",
                  minimumFractionDigits: 0,
                }).format(typeof details.amount === 'string' ? parseFloat(details.amount) : details.amount)}</div>
                          </div>
                          <div class="info-item">
                            <div class="info-label">Needed On</div>
                            <div class="info-value">${format(new Date(details.neededOn), "MMMM dd, yyyy")}</div>
                          </div>
                          <div class="info-item">
                            <div class="info-label">Deduction Month & Year</div>
                            <div class="info-value">${format(new Date(`${details.deductionMonthYear}-01`), "MMMM yyyy")}</div>
                          </div>
                          <div class="info-item">
                            <div class="info-label">Status</div>
                            <div class="info-value">
                              <span class="badge badge-${details.status === 'active' ? 'approved' : details.status === 'pending' ? 'pending' : 'rejected'}">
                                ${details.status}
                              </span>
                            </div>
                          </div>
                          <div class="info-item">
                            <div class="info-label">Approval Status</div>
                            <div class="info-value">
                              <span class="badge badge-${details.approvalStatus === 'approved' ? 'approved' : details.approvalStatus === 'pending' ? 'pending' : 'rejected'}">
                                ${details.approvalStatus}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div class="info-section">
                        <h2>Reason</h2>
                        <div class="reason-box">
                          ${details.reason.replace(/\n/g, '<br>')}
                        </div>
                      </div>

                      ${details.rejectionReason ? `
                      <div class="info-section">
                        <h2>Rejection Reason</h2>
                        <div class="reason-box">
                          ${details.rejectionReason.replace(/\n/g, '<br>')}
                        </div>
                      </div>
                      ` : ''}

                      <div class="info-section">
                        <h2>Audit Information</h2>
                        <div class="info-grid">
                          <div class="info-item">
                            <div class="info-label">Created By</div>
                            <div class="info-value">${details.createdBy ? `${details.createdBy.firstName} ${details.createdBy.lastName}` : "—"}</div>
                          </div>
                          <div class="info-item">
                            <div class="info-label">Created At</div>
                            <div class="info-value">${format(new Date(details.createdAt), "MMMM dd, yyyy 'at' hh:mm a")}</div>
                          </div>
                          ${details.approvedBy ? `
                          <div class="info-item">
                            <div class="info-label">Approved By</div>
                            <div class="info-value">${details.approvedBy.firstName} ${details.approvedBy.lastName}</div>
                          </div>
                          <div class="info-item">
                            <div class="info-label">Approved At</div>
                            <div class="info-value">${details.approvedAt ? format(new Date(details.approvedAt), "MMMM dd, yyyy 'at' hh:mm a") : "—"}</div>
                          </div>
                          ` : ''}
                        </div>
                      </div>

                      <div class="footer">
                        <p>This is a system-generated document.</p>
                      </div>
                    </body>
                  </html>
                `;

                printWindow.document.write(printContent);
                printWindow.document.close();
                printWindow.focus();
                setTimeout(() => {
                  printWindow.print();
                }, 250);
              }
            }}
            disabled={isPending}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setDeleteDialog(true)}
            disabled={isPending || !canDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={handleViewClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>Advance Salary Details</DialogTitle>
            <DialogDescription>
              Complete information about the advance salary request
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : advanceSalaryDetails ? (
              <div className="space-y-6 py-4">
                {/* Employee Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Employee Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Employee ID</Label>
                      <p className="font-medium">{advanceSalaryDetails.employee?.employeeId || record.empId}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Employee Name</Label>
                      <p className="font-medium">{advanceSalaryDetails.employee?.employeeName || record.empName}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Department</Label>
                      <p className="font-medium">{advanceSalaryDetails.employee?.department?.name || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Sub Department</Label>
                      <p className="font-medium">{advanceSalaryDetails.employee?.subDepartment?.name || "—"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Advance Salary Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Advance Salary Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Amount</Label>
                      <p className="font-semibold text-lg">
                        {new Intl.NumberFormat("en-PK", {
                          style: "currency",
                          currency: "PKR",
                          minimumFractionDigits: 0,
                        }).format(typeof advanceSalaryDetails.amount === 'string' ? parseFloat(advanceSalaryDetails.amount) : advanceSalaryDetails.amount)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Needed On</Label>
                      <p className="font-medium">
                        {format(new Date(advanceSalaryDetails.neededOn), "MMMM dd, yyyy")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Deduction Month & Year</Label>
                      <p className="font-medium">
                        {format(new Date(`${advanceSalaryDetails.deductionMonthYear}-01`), "MMMM yyyy")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Status</Label>
                      <div>
                        <Badge variant={advanceSalaryDetails.status === 'active' ? 'default' : advanceSalaryDetails.status === 'pending' ? 'secondary' : 'destructive'}>
                          {advanceSalaryDetails.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Approval Status</Label>
                      <div>
                        <Badge variant={advanceSalaryDetails.approvalStatus === 'approved' ? 'default' : advanceSalaryDetails.approvalStatus === 'pending' ? 'secondary' : 'destructive'}>
                          {advanceSalaryDetails.approvalStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Reason */}
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Reason</Label>
                  <div className="bg-muted p-4 rounded-md">
                    <p className="text-sm whitespace-pre-wrap">{advanceSalaryDetails.reason}</p>
                  </div>
                </div>

                {advanceSalaryDetails.rejectionReason && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Rejection Reason</Label>
                      <div className="bg-destructive/10 p-4 rounded-md">
                        <p className="text-sm whitespace-pre-wrap">{advanceSalaryDetails.rejectionReason}</p>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Audit Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Audit Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Created By</Label>
                      <p className="font-medium">
                        {advanceSalaryDetails.createdBy
                          ? `${advanceSalaryDetails.createdBy.firstName} ${advanceSalaryDetails.createdBy.lastName}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Created At</Label>
                      <p className="font-medium">
                        {format(new Date(advanceSalaryDetails.createdAt), "MMMM dd, yyyy 'at' hh:mm a")}
                      </p>
                    </div>
                    {advanceSalaryDetails.approvedBy && (
                      <>
                        <div>
                          <Label className="text-sm text-muted-foreground">Approved By</Label>
                          <p className="font-medium">
                            {`${advanceSalaryDetails.approvedBy.firstName} ${advanceSalaryDetails.approvedBy.lastName}`}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Approved At</Label>
                          <p className="font-medium">
                            {advanceSalaryDetails.approvedAt
                              ? format(new Date(advanceSalaryDetails.approvedAt), "MMMM dd, yyyy 'at' hh:mm a")
                              : "—"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Failed to load details</p>
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t shrink-0 px-6 py-4">
            <Button variant="outline" onClick={handleViewClose}>
              Close
            </Button>
            <Button onClick={handlePrint} disabled={!advanceSalaryDetails}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={handleEditClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b shrink-0 px-6 pt-6 pb-4">
            <DialogTitle>Edit Advance Salary Request</DialogTitle>
            <DialogDescription>
              Update the advance salary request details
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-6 py-4">
                  {/* Employee Info (Read-only) */}
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Employee</Label>
                    <p className="font-medium">
                      {advanceSalaryDetails?.employee?.employeeName || record.empName} ({advanceSalaryDetails?.employee?.employeeId || record.empId})
                    </p>
                  </div>

                  {/* Amount */}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Amount <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            disabled={isPending}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter the advance salary amount
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Needed On */}
                  <FormField
                    control={form.control}
                    name="neededOn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Advance Salary Needed On <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isPending}
                            placeholder="Select date"
                          />
                        </FormControl>
                        <FormDescription>
                          When the advance salary is needed
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Deduction Month-Year */}
                  <FormField
                    control={form.control}
                    name="deductionMonthYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Deduction Month & Year <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <MonthYearPicker
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isPending}
                            placeholder="Select month and year"
                          />
                        </FormControl>
                        <FormDescription>
                          When the advance will be deducted from salary
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Reason */}
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Reason (Detail) <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter detailed reason for advance salary request..."
                            rows={4}
                            disabled={isPending}
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Provide a detailed reason (10-500 characters)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}
          </ScrollArea>
          <DialogFooter className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm border-t shrink-0 px-6 py-4">
            <Button variant="outline" onClick={handleEditClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={form.handleSubmit(handleEditSubmit)}
              disabled={isPending || loadingDetails}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the advance salary request for{" "}
              <strong>{record.empName}</strong> (Amount: {new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
              }).format(record.amountNeeded)}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Advance Salary Request?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject the advance salary request for{" "}
              <strong>{record.empName}</strong>? This action will mark the request as rejected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Rejecting..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const columns: ColumnDef<AdvanceSalaryRow>[] = [
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
    accessorKey: "empId",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        EMP ID
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
        Employee Name
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.empName}</div>
    ),
    size: 150,
  },
  {
    accessorKey: "amountNeeded",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Amount Needed
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-semibold">
        {new Intl.NumberFormat("en-PK", {
          style: "currency",
          currency: "PKR",
          minimumFractionDigits: 0,
        }).format(row.original.amountNeeded)}
      </div>
    ),
    size: 130,
  },
  {
    accessorKey: "salaryNeedOn",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Salary Need On
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.salaryNeedOn}</div>
    ),
    size: 130,
  },
  {
    accessorKey: "deductionMonthYear",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Deduction Month/year
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.deductionMonthYear}</div>
    ),
    size: 150,
  },
  // {
  //   accessorKey: "approval1",
  //   header: () => (
  //     <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
  //       Approval 1
  //     </div>
  //   ),
  //   cell: ({ row }) => {
  //     const approval = row.original.approval1;
  //     const variant =
  //       approval === "Approved"
  //         ? "default"
  //         : approval === "Pending"
  //         ? "secondary"
  //         : "destructive";
  //     return (
  //       <Badge variant={variant} className="font-medium">
  //         {approval}
  //       </Badge>
  //     );
  //   },
  //   size: 120,
  // },
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
    id: "actions",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
        Actions
      </div>
    ),
    cell: ({ row }) => <RowActions row={row} />,
    size: 80,
    enableHiding: false,
  },
];
