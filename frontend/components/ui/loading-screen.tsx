"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface LoadingScreenProps {
  progress: number;
  message?: string;
}

export function LoadingScreen({ progress, message = "Loading..." }: LoadingScreenProps) {
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    // Animate progress smoothly
    const timer = setTimeout(() => {
      setDisplayProgress(progress);
    }, 50);
    return () => clearTimeout(timer);
  }, [progress]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-6">
          {/* Animated Spinner */}
          <div className="relative w-20 h-20">
            <motion.div
              className="absolute inset-0 border-4 border-primary/20 rounded-full"
            />
            <motion.div
              className="absolute inset-0 border-4 border-transparent border-t-primary rounded-full"
              animate={{ rotate: 360 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-semibold text-primary">
                {Math.round(displayProgress)}%
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>

          {/* Message */}
          <motion.p
            key={message}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground font-medium"
          >
            {message}
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

