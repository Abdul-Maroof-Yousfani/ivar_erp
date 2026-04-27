"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User as UserIcon, Settings, LogOut, Shield, History, Key, UserPlus, ChevronRight } from "lucide-react";
import { createNavigationHandler } from "@/lib/navigation";
import { getAvailableProfilesClient, User as AuthUser } from "@/lib/client-auth";
import { useEffect, useState } from "react";

export function HeaderUserMenu() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [otherProfiles, setOtherProfiles] = useState<AuthUser[]>([]);

  useEffect(() => {
    if (user) {
      getAvailableProfilesClient().then(profiles => {
        setOtherProfiles(profiles.filter(p => p.email !== user.email));
      });
    }
  }, [user]);

  // Create navigation handler with router
  const navigate = createNavigationHandler(router);

  if (loading || !user) {
    return (
      <Button variant="ghost" className="relative h-9 w-9 rounded-full">
        <Avatar className="h-9 w-9">
          <AvatarFallback>
            <UserIcon className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </Button>
    );
  }

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const isAdmin = user.role?.name === "admin" || user.role?.name === "super_admin";

  const handleSwitchAccount = (email: string) => {
    router.push(`/auth/login?email=${email}`);
  };

  const handleAddAccount = () => {
    router.push("/auth/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-linear-to-br from-blue-500 to-cyan-500 text-white text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            {user.role && (
              <p className="text-xs text-blue-500 capitalize">{user.role.name.replace("_", " ")}</p>
            )}
          </div>
        </DropdownMenuLabel>

        {otherProfiles.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-bold uppercase text-muted-foreground py-1">Switch Account</DropdownMenuLabel>
            {otherProfiles.map(p => (
              <DropdownMenuItem key={p.id} onClick={() => handleSwitchAccount(p.email)} className="gap-3">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {p.firstName[0]}{p.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{p.firstName} {p.lastName}</p>
                </div>
                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-50" />
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleAddAccount}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add another account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/hr/settings/profile")}>
            <UserIcon className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/hr/settings/password")}>
            <Key className="mr-2 h-4 w-4" />
            Change Password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/hr/settings/sessions")}>
            <History className="mr-2 h-4 w-4" />
            Active Sessions
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/admin")}>
                <Shield className="mr-2 h-4 w-4" />
                Admin Panel
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
