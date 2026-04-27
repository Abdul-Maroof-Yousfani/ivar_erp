"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createSocialSecurityInstitutions } from "@/lib/actions/social-security";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

interface InstitutionRow {
  id: number;
  code: string;
  name: string;
  province: string;
  description: string;
  website: string;
  contactNumber: string;
  address: string;
  contributionRate: string;
}

export default function AddSocialSecurityPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [institutions, setInstitutions] = useState<InstitutionRow[]>([
    { id: 1, code: "", name: "", province: "", description: "", website: "", contactNumber: "", address: "", contributionRate: "" },
  ]);

  const addRow = () => {
    setInstitutions([
      ...institutions,
      { id: Date.now(), code: "", name: "", province: "", description: "", website: "", contactNumber: "", address: "", contributionRate: "" },
    ]);
  };

  const removeRow = (id: number) => {
    if (institutions.length > 1) setInstitutions(institutions.filter((i) => i.id !== id));
  };

  const updateField = (id: number, field: keyof InstitutionRow, value: string) => {
    setInstitutions(institutions.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = institutions
      .filter((i) => i.code.trim() && i.name.trim())
      .map((i) => ({
        code: i.code.trim(),
        name: i.name.trim(),
        province: i.province.trim() || undefined,
        description: i.description.trim() || undefined,
        website: i.website.trim() || undefined,
        contactNumber: i.contactNumber.trim() || undefined,
        address: i.address.trim() || undefined,
        contributionRate: i.contributionRate ? parseFloat(i.contributionRate) : 0,
      }));

    if (items.length === 0) {
      toast.error("Please fill in at least code and name for one institution");
      return;
    }

    startTransition(async () => {
      const result = await createSocialSecurityInstitutions(items);
      if (result.status) {
        toast.success(result.message);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/master/social-security/list");
        });
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/master/social-security/list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Social Security Institution</CardTitle>
          <CardDescription>Create one or more social security institutions (SESSI, PESSE, IESSI, etc.)</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {institutions.map((institution, index) => (
              <div key={institution.id} className="space-y-4 border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-medium">
                    Institution {index + 1}
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(institution.id)}
                    disabled={institutions.length === 1 || isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Code * <span className="text-xs text-muted-foreground">(e.g., SESSI, PESSE, IESSI)</span></Label>
                    <Input
                      placeholder="SESSI"
                      value={institution.code}
                      onChange={(e) => updateField(institution.id, "code", e.target.value)}
                      disabled={isPending}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      placeholder="Sindh Employees Social Security Institution"
                      value={institution.name}
                      onChange={(e) => updateField(institution.id, "name", e.target.value)}
                      disabled={isPending}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Province</Label>
                    <Input
                      placeholder="Sindh"
                      value={institution.province}
                      onChange={(e) => updateField(institution.id, "province", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Number</Label>
                    <Input
                      placeholder="+92-21-12345678"
                      value={institution.contactNumber}
                      onChange={(e) => updateField(institution.id, "contactNumber", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Website</Label>
                    <Input
                      type="url"
                      placeholder="https://sessi.org.pk"
                      value={institution.website}
                      onChange={(e) => updateField(institution.id, "website", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      placeholder="Karachi, Pakistan"
                      value={institution.address}
                      onChange={(e) => updateField(institution.id, "address", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contribution Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="6.0"
                      value={institution.contributionRate}
                      onChange={(e) => updateField(institution.id, "contributionRate", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Social security institution for Sindh province"
                      value={institution.description}
                      onChange={(e) => updateField(institution.id, "description", e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex gap-2 justify-between">
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create {institutions.length > 1 ? `${institutions.length} Institutions` : "Institution"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    startTransition(() => {
                      addTransitionType("nav-back");
                      router.back();
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
              <button
                type="button"
                onClick={addRow}
                disabled={isPending}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                + Add more
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

