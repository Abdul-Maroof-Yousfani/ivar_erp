import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Users, FileText, Settings } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System administration and overview.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <Link href="/admin/roles">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Roles & Permissions
              </CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Manage</div>
              <p className="text-xs text-muted-foreground">
                Configure access controls
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <Link href="/admin/activity-logs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Activity Logs
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">View</div>
              <p className="text-xs text-muted-foreground">
                Audit system actions
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          <Link href="/admin/settings">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                System Settings
              </CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Configure</div>
              <p className="text-xs text-muted-foreground">
                Global system preferences
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
