import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">
          Manage global system configurations.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Configure basic system behavior.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Disable access for non-admin users.
                </p>
              </div>
              <Switch />
            </div>
            <div className="space-y-2">
                <Label>System Name</Label>
                <Input placeholder="HR Management System" defaultValue="Speed Limit HRMS" />
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>
                    Password policies and session management.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Enforce Strong Passwords</Label>
                        <p className="text-sm text-muted-foreground">
                            Require special characters and numbers.
                        </p>
                    </div>
                    <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label>Two-Factor Authentication</Label>
                        <p className="text-sm text-muted-foreground">
                            Enable 2FA for all admin accounts.
                        </p>
                    </div>
                    <Switch />
                </div>
            </CardContent>
        </Card>
        
        <div className="flex justify-end">
            <Button>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
