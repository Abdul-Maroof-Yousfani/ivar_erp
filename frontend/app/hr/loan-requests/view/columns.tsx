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
  approveLoanRequest,
  rejectLoanRequest,
  deleteLoanRequest,
  getLoanRequestById,
  updateLoanRequest,
  type LoanRequest,
} from "@/lib/actions/loan-request";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import { getLoanTypes, type LoanType } from "@/lib/actions/loan-type";
import { useAuth } from "@/components/providers/auth-provider";

export interface LoanRequestRow {
  id: string;
  sNo: number;
  empId: string;
  empName: string;
  department: string;
  loanType: string;
  amount: number;
  requestedDate: string;
  repaymentStartMonthYear: string;
  numberOfInstallments: string | number;
  approvalStatus: string;
  status: string;
  paidAmount?: number;
  remainingAmount?: number;
  createdById?: string;
}

// Edit form schema
const editLoanRequestSchema = z.object({
  loanTypeId: z.string().min(1, "Loan type is required"),
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
  requestedDate: z.string().min(1, "Requested date is required"),
  repaymentStartMonthYear: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d{4}-\d{2}$/.test(val),
      "Invalid month-year format (YYYY-MM)"
    ),
  numberOfInstallments: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const num = parseInt(val);
        return !isNaN(num) && num > 0 && num <= 120;
      },
      "Number of installments must be between 1 and 120"
    ),
  reason: z
    .string()
    .min(1, "Reason is required")
    .min(10, "Reason must be at least 10 characters")
    .max(1000, "Reason must not exceed 1000 characters"),
  additionalDetails: z
    .string()
    .max(2000, "Additional details must not exceed 2000 characters")
    .optional(),
});

type EditLoanRequestFormData = z.infer<typeof editLoanRequestSchema>;

function RowActions({ row }: { row: { original: LoanRequestRow } }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [viewDialog, setViewDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [loanRequestDetails, setLoanRequestDetails] = useState<LoanRequest | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);
  const { user } = useAuth();
  const record = row.original;

  // Check if current user created this request
  const isCreatedByCurrentUser = record.createdById === user?.id;

  const form = useForm<EditLoanRequestFormData>({
    resolver: zodResolver(editLoanRequestSchema) as any,
    defaultValues: {
      loanTypeId: "",
      amount: "",
      requestedDate: "",
      repaymentStartMonthYear: undefined,
      numberOfInstallments: "",
      reason: "",
      additionalDetails: "",
    },
    mode: "onBlur",
  });

  // Load loan types
  useEffect(() => {
    if (editDialog && loanTypes.length === 0) {
      setLoadingLoanTypes(true);
      getLoanTypes().then((res) => {
        if (res.status && res.data) {
          setLoanTypes(res.data);
        }
        setLoadingLoanTypes(false);
      });
    }
  }, [editDialog, loanTypes.length]);

  // Load loan request details for view
  useEffect(() => {
    if (viewDialog && !loanRequestDetails) {
      setLoadingDetails(true);
      getLoanRequestById(record.id).then((res) => {
        if (res.status && res.data) {
          setLoanRequestDetails(res.data);
        } else {
          toast.error(res.message || "Failed to load loan request details");
          setViewDialog(false);
        }
        setLoadingDetails(false);
      });
    }
  }, [viewDialog, record.id, loanRequestDetails]);

  // Load loan request details for edit
  useEffect(() => {
    if (editDialog) {
      setLoadingDetails(true);
      getLoanRequestById(record.id).then((res) => {
        if (res.status && res.data) {
          const data = res.data;
          setLoanRequestDetails(data);
          form.reset({
            loanTypeId: data.loanTypeId,
            amount: typeof data.amount === 'string' ? data.amount : data.amount.toString(),
            requestedDate: data.requestedDate,
            repaymentStartMonthYear: data.repaymentStartMonthYear || undefined,
            numberOfInstallments: data.numberOfInstallments?.toString() || "",
            reason: data.reason,
            additionalDetails: data.additionalDetails || "",
          });
        } else {
          toast.error(res.message || "Failed to load loan request details");
          setEditDialog(false);
        }
        setLoadingDetails(false);
      });
    }
  }, [editDialog, record.id, form]);

  const handleApprove = async () => {
    startTransition(async () => {
      const result = await approveLoanRequest(record.id);
      if (result.status) {
        toast.success(result.message || "Loan request approved successfully");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to approve loan request");
      }
    });
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    startTransition(async () => {
      const result = await rejectLoanRequest(record.id, rejectionReason);
      if (result.status) {
        toast.success(result.message || "Loan request rejected successfully");
        setRejectDialog(false);
        setRejectionReason("");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to reject loan request");
      }
    });
  };

  const handleDelete = async () => {
    startTransition(async () => {
      const result = await deleteLoanRequest(record.id);
      if (result.status) {
        toast.success(result.message || "Loan request deleted successfully");
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete loan request");
      }
    });
  };

  const handleEditSubmit = async (data: EditLoanRequestFormData) => {
    startTransition(async () => {
      const result = await updateLoanRequest(record.id, {
        loanTypeId: data.loanTypeId,
        amount: parseFloat(data.amount),
        requestedDate: data.requestedDate,
        repaymentStartMonthYear: data.repaymentStartMonthYear || undefined,
        numberOfInstallments: data.numberOfInstallments ? parseInt(data.numberOfInstallments) : undefined,
        reason: data.reason,
        additionalDetails: data.additionalDetails || undefined,
      });
      if (result.status) {
        toast.success(result.message || "Loan request updated successfully");
        setEditDialog(false);
        setLoanRequestDetails(null);
        form.reset();
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update loan request");
      }
    });
  };

  const handlePrint = () => {
    if (!loanRequestDetails) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    const formatMonthYear = (monthYear?: string) => {
      if (!monthYear) return "—";
      const [year, month] = monthYear.split("-");
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const monthIndex = parseInt(month) - 1;
      return `${monthNames[monthIndex] || month} ${year}`;
    };

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Loan Request - ${loanRequestDetails.employee?.employeeName || record.empName}</title>
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
            .badge-disbursed {
              background: #3b82f6;
              color: white;
            }
            .badge-completed {
              background: #10b981;
              color: white;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Loan Request</h1>
            <p>Generated on ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}</p>
          </div>

          <div class="info-section">
            <h2>Employee Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Employee ID</div>
                <div class="info-value">${loanRequestDetails.employee?.employeeId || record.empId}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Employee Name</div>
                <div class="info-value">${loanRequestDetails.employee?.employeeName || record.empName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Department</div>
                <div class="info-value">${loanRequestDetails.employee?.department?.name || "—"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Sub Department</div>
                <div class="info-value">${loanRequestDetails.employee?.subDepartment?.name || "—"}</div>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h2>Loan Details</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Loan Type</div>
                <div class="info-value">${loanRequestDetails.loanType?.name || record.loanType}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Amount</div>
                <div class="info-value">${new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(typeof loanRequestDetails.amount === 'string' ? parseFloat(loanRequestDetails.amount) : loanRequestDetails.amount)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Requested Date</div>
                <div class="info-value">${format(new Date(loanRequestDetails.requestedDate), "MMMM dd, yyyy")}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Repayment Start</div>
                <div class="info-value">${formatMonthYear(loanRequestDetails.repaymentStartMonthYear)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Number of Installments</div>
                <div class="info-value">${loanRequestDetails.numberOfInstallments || "—"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">
                  <span class="badge badge-${loanRequestDetails.status === 'approved' || loanRequestDetails.status === 'completed' ? 'approved' : loanRequestDetails.status === 'disbursed' ? 'disbursed' : loanRequestDetails.status === 'pending' ? 'pending' : 'rejected'}">
                    ${loanRequestDetails.status}
                  </span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">Approval Status</div>
                <div class="info-value">
                  <span class="badge badge-${loanRequestDetails.approvalStatus === 'approved' ? 'approved' : loanRequestDetails.approvalStatus === 'pending' ? 'pending' : 'rejected'}">
                    ${loanRequestDetails.approvalStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h2>Reason</h2>
            <div class="reason-box">
              ${loanRequestDetails.reason.replace(/\n/g, '<br>')}
            </div>
          </div>

          ${loanRequestDetails.additionalDetails ? `
          <div class="info-section">
            <h2>Additional Details</h2>
            <div class="reason-box">
              ${loanRequestDetails.additionalDetails.replace(/\n/g, '<br>')}
            </div>
          </div>
          ` : ''}

          ${loanRequestDetails.rejectionReason ? `
          <div class="info-section">
            <h2>Rejection Reason</h2>
            <div class="reason-box">
              ${loanRequestDetails.rejectionReason.replace(/\n/g, '<br>')}
            </div>
          </div>
          ` : ''}

          <div class="info-section">
            <h2>Audit Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Created By</div>
                <div class="info-value">${loanRequestDetails.createdBy ? `${loanRequestDetails.createdBy.firstName} ${loanRequestDetails.createdBy.lastName}` : "—"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Created At</div>
                <div class="info-value">${format(new Date(loanRequestDetails.createdAt), "MMMM dd, yyyy 'at' hh:mm a")}</div>
              </div>
              ${loanRequestDetails.approvedBy ? `
              <div class="info-item">
                <div class="info-label">Approved By</div>
                <div class="info-value">${loanRequestDetails.approvedBy.firstName} ${loanRequestDetails.approvedBy.lastName}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Approved At</div>
                <div class="info-value">${loanRequestDetails.approvedAt ? format(new Date(loanRequestDetails.approvedAt), "MMMM dd, yyyy 'at' hh:mm a") : "—"}</div>
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
    setLoanRequestDetails(null);
  };

  const handleEditClose = () => {
    setEditDialog(false);
    setLoanRequestDetails(null);
    form.reset();
  };

  const isPendingApproval = record.approvalStatus === "Pending";
  const isApproved = record.approvalStatus === "Approved";
  const isRejected = record.approvalStatus === "Rejected";

  const loanTypeOptions = loanTypes.map((lt) => ({
    value: lt.id,
    label: lt.name,
  }));

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
                disabled={isPending || isCreatedByCurrentUser}
                className="text-green-600 focus:text-green-600"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setRejectDialog(true)}
                disabled={isPending || isCreatedByCurrentUser}
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
            disabled={isPending || isApproved}
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={async () => {
              let details = loanRequestDetails;
              if (!details) {
                setLoadingDetails(true);
                const res = await getLoanRequestById(record.id);
                if (res.status && res.data) {
                  details = res.data;
                  setLoanRequestDetails(details);
                } else {
                  toast.error("Failed to load details for printing");
                  setLoadingDetails(false);
                  return;
                }
                setLoadingDetails(false);
              }
              handlePrint();
            }}
            disabled={isPending}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setDeleteDialog(true)}
            disabled={isPending}
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
            <DialogTitle>Loan Request Details</DialogTitle>
            <DialogDescription>
              Complete information about the loan request
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : loanRequestDetails ? (
              <div className="space-y-6 py-4">
                {/* Employee Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Employee Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Employee ID</Label>
                      <p className="font-medium">{loanRequestDetails.employee?.employeeId || record.empId}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Employee Name</Label>
                      <p className="font-medium">{loanRequestDetails.employee?.employeeName || record.empName}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Department</Label>
                      <p className="font-medium">{loanRequestDetails.employee?.department?.name || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Sub Department</Label>
                      <p className="font-medium">{loanRequestDetails.employee?.subDepartment?.name || "—"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Loan Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Loan Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Loan Type</Label>
                      <p className="font-medium">{loanRequestDetails.loanType?.name || record.loanType}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Amount</Label>
                      <p className="font-semibold text-lg">
                        {new Intl.NumberFormat("en-PK", {
                          style: "currency",
                          currency: "PKR",
                          minimumFractionDigits: 0,
                        }).format(typeof loanRequestDetails.amount === 'string' ? parseFloat(loanRequestDetails.amount) : loanRequestDetails.amount)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Requested Date</Label>
                      <p className="font-medium">
                        {format(new Date(loanRequestDetails.requestedDate), "MMMM dd, yyyy")}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Repayment Start</Label>
                      <p className="font-medium">
                        {loanRequestDetails.repaymentStartMonthYear
                          ? format(new Date(`${loanRequestDetails.repaymentStartMonthYear}-01`), "MMMM yyyy")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Number of Installments</Label>
                      <p className="font-medium">{loanRequestDetails.numberOfInstallments || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Status</Label>
                      <div>
                        <Badge variant={loanRequestDetails.status === 'approved' || loanRequestDetails.status === 'completed' ? 'default' : loanRequestDetails.status === 'disbursed' ? 'default' : loanRequestDetails.status === 'pending' ? 'secondary' : 'destructive'}>
                          {loanRequestDetails.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Approval Status</Label>
                      <div>
                        <Badge variant={loanRequestDetails.approvalStatus === 'approved' ? 'default' : loanRequestDetails.approvalStatus === 'pending' ? 'secondary' : 'destructive'}>
                          {loanRequestDetails.approvalStatus}
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
                    <p className="text-sm whitespace-pre-wrap">{loanRequestDetails.reason}</p>
                  </div>
                </div>

                {loanRequestDetails.additionalDetails && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Additional Details</Label>
                      <div className="bg-muted p-4 rounded-md">
                        <p className="text-sm whitespace-pre-wrap">{loanRequestDetails.additionalDetails}</p>
                      </div>
                    </div>
                  </>
                )}

                {loanRequestDetails.rejectionReason && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Rejection Reason</Label>
                      <div className="bg-destructive/10 p-4 rounded-md">
                        <p className="text-sm whitespace-pre-wrap">{loanRequestDetails.rejectionReason}</p>
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
                        {loanRequestDetails.createdBy
                          ? `${loanRequestDetails.createdBy.firstName} ${loanRequestDetails.createdBy.lastName}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Created At</Label>
                      <p className="font-medium">
                        {format(new Date(loanRequestDetails.createdAt), "MMMM dd, yyyy 'at' hh:mm a")}
                      </p>
                    </div>
                    {loanRequestDetails.approvedBy && (
                      <>
                        <div>
                          <Label className="text-sm text-muted-foreground">Approved By</Label>
                          <p className="font-medium">
                            {`${loanRequestDetails.approvedBy.firstName} ${loanRequestDetails.approvedBy.lastName}`}
                          </p>
                        </div>
                        <div>
                          <Label className="text-sm text-muted-foreground">Approved At</Label>
                          <p className="font-medium">
                            {loanRequestDetails.approvedAt
                              ? format(new Date(loanRequestDetails.approvedAt), "MMMM dd, yyyy 'at' hh:mm a")
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
            <Button onClick={handlePrint} disabled={!loanRequestDetails}>
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
            <DialogTitle>Edit Loan Request</DialogTitle>
            <DialogDescription>
              Update the loan request details
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6">
            {loadingDetails || loadingLoanTypes ? (
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
                      {loanRequestDetails?.employee?.employeeName || record.empName} ({loanRequestDetails?.employee?.employeeId || record.empId})
                    </p>
                  </div>

                  {/* Loan Type */}
                  <FormField
                    control={form.control}
                    name="loanTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Loan Type <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Autocomplete
                            options={loanTypeOptions}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Select loan type"
                            searchPlaceholder="Search loan type..."
                            emptyMessage="No loan types found"
                            disabled={isPending || loadingLoanTypes}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Requested Date */}
                  <FormField
                    control={form.control}
                    name="requestedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Requested Date <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isPending}
                            placeholder="Select date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Repayment Start Month-Year */}
                  <FormField
                    control={form.control}
                    name="repaymentStartMonthYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Repayment Start Month & Year
                        </FormLabel>
                        <FormControl>
                          <MonthYearPicker
                            value={field.value}
                            onChange={field.onChange}
                            disabled={isPending}
                            placeholder="Select month and year"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Number of Installments */}
                  <FormField
                    control={form.control}
                    name="numberOfInstallments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Number of Installments
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="120"
                            placeholder="Enter number of installments"
                            disabled={isPending}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Number of installments (1-120)
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
                          Reason <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter detailed reason for loan request..."
                            rows={4}
                            disabled={isPending}
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Provide a detailed reason (10-1000 characters)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Additional Details */}
                  <FormField
                    control={form.control}
                    name="additionalDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Additional Details
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter any additional details (optional)..."
                            rows={3}
                            disabled={isPending}
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Any additional information (max 2000 characters)
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
              disabled={isPending || loadingDetails || loadingLoanTypes}
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
              This action cannot be undone. This will permanently delete the loan request for{" "}
              <strong>{record.empName}</strong> (Amount: {new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
              }).format(record.amount)}).
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
            <AlertDialogTitle>Reject Loan Request?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Are you sure you want to reject the loan request for{" "}
                  <strong>{record.empName}</strong>? This action will mark the request as rejected.
                </p>
                <div className="space-y-2">
                  <Label>Rejection Reason <span className="text-destructive">*</span></Label>
                  <Textarea
                    placeholder="Enter reason for rejection..."
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="resize-none"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending} onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={isPending || !rejectionReason.trim()}
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

export const getColumns = (isAdmin: boolean): ColumnDef<LoanRequestRow>[] => {
  const baseColumns: ColumnDef<LoanRequestRow>[] = [
    {
      accessorKey: "sNo",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          S.No
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm font-medium">{row.original.sNo}</div>
      ),
    },
    {
      accessorKey: "empId",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Employee ID
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm">{row.original.empId}</div>
      ),
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
    },
    {
      accessorKey: "department",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Department
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm">{row.original.department}</div>
      ),
    },
    {
      accessorKey: "loanType",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Loan Type
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm">{row.original.loanType}</div>
      ),
    },
    {
      accessorKey: "amount",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
          Amount
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm font-medium text-right">
          {new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency: "PKR",
            minimumFractionDigits: 0,
          }).format(row.original.amount)}
        </div>
      ),
    },
    {
      accessorKey: "paidAmount",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
          Paid Amount
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm font-medium text-right text-green-600">
          {row.original.paidAmount !== undefined ? new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency: "PKR",
            minimumFractionDigits: 0,
          }).format(row.original.paidAmount) : "—"}
        </div>
      ),
    },
    {
      accessorKey: "remainingAmount",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
          Remaining
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm font-medium text-right text-destructive">
          {row.original.remainingAmount !== undefined ? new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency: "PKR",
            minimumFractionDigits: 0,
          }).format(row.original.remainingAmount) : "—"}
        </div>
      ),
    },
    {
      accessorKey: "requestedDate",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Requested Date
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm">{row.original.requestedDate}</div>
      ),
    },
    {
      accessorKey: "repaymentStartMonthYear",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Repayment Start
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm">{row.original.repaymentStartMonthYear}</div>
      ),
    },
    {
      accessorKey: "numberOfInstallments",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
          Installments
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-center">{row.original.numberOfInstallments}</div>
      ),
    },
    {
      accessorKey: "approvalStatus",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
          Approval Status
        </div>
      ),
      cell: ({ row }) => {
        const status = row.original.approvalStatus;
        return (
          <div className="flex justify-center">
            <Badge
              variant={
                status === "Approved"
                  ? "default"
                  : status === "Pending"
                    ? "secondary"
                    : "destructive"
              }
            >
              {status}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: () => (
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
          Status
        </div>
      ),
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <div className="flex justify-center">
            <Badge
              variant={
                status === "Approved" || status === "Completed" || status === "Disbursed"
                  ? "default"
                  : status === "Pending"
                    ? "secondary"
                    : "destructive"
              }
            >
              {status}
            </Badge>
          </div>
        );
      },
    },
  ];

  if (isAdmin) {
    baseColumns.push({
      id: "actions",
      cell: ({ row }) => <RowActions row={row} />,
    });
  }

  return baseColumns;
};
