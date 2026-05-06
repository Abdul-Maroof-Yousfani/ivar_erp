
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Search, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/theme-toggle"; // Imported here
import { PosClock } from "@/components/pos/pos-clock";

export function PosHeader() {
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-background px-6 justify-between shrink-0">
      
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Scan barcode or search products..."
            className="w-full bg-background pl-8 md:w-[300px] lg:w-[400px]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <PosClock />
        <ThemeToggle /> {/* Added here */}
        
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Settings className="h-5 w-5" />
        </Button>
        <div className="ml-2 flex items-center gap-3 border-l pl-4">
             <div className="flex flex-col items-end">
                 <span className="text-sm font-semibold leading-none">John Doe</span>
                 <span className="text-xs text-muted-foreground">Cashier</span>
             </div>
             <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium overflow-hidden border border-primary/20">
                 JD
                 {/* <img src="/placeholder-user.jpg" alt="User" /> */}
             </div>
        </div>
      </div>
    </header>
  );
}
