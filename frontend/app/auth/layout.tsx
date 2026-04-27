import { cn } from "@/lib/utils";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-linear-to-br from-background to-secondary/20 flex items-center justify-center p-4 font-geist relative overflow-hidden">
      {/* Shared Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] opacity-50" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] opacity-30" />
      </div>

      <div className="w-full max-w-md relative z-10 transition-all duration-500 animate-in fade-in zoom-in-95">
        {children}
      </div>
    </div>
  );
}
