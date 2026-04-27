'use client';

import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Home, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Animated404Props {
  onHomeClick?: () => void;
  onRetryClick?: () => void;
  title?: string;
  subtitle?: string;
  showRetry?: boolean;
}

export function Animated404({
  onHomeClick,
  onRetryClick,
  title = "404",
  subtitle = "Page Not Found",
  showRetry = false,
}: Animated404Props) {
  const [glitchActive, setGlitchActive] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center relative overflow-hidden">
      {/* Background gradient orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-400/20 to-purple-500/20 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-gradient-to-r from-pink-400/20 to-yellow-500/20 rounded-full blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.5, 0.3, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />

      <div className="text-center z-10 px-4 max-w-lg mx-auto">
        {/* Main title with glitch effect */}
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-6"
        >
          <motion.h1
            className={`text-7xl md:text-8xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent ${
              glitchActive ? 'animate-pulse' : ''
            }`}
            animate={glitchActive ? {
              x: [0, -2, 2, 0],
              textShadow: [
                "0 0 0px #ff0000",
                "2px 0 0px #ff0000, -2px 0 0px #00ffff",
                "0 0 0px #ff0000",
              ],
            } : {}}
            transition={{ duration: 0.2 }}
          >
            {title}
          </motion.h1>
        </motion.div>

        {/* Subtitle with typewriter effect */}
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-xl md:text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4"
        >
          {subtitle}
        </motion.h2>

        {/* Animated icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mb-8"
        >
          <motion.div
            animate={{
              rotate: [0, 360],
              scale: [1, 1.1, 1],
            }}
            transition={{
              rotate: { duration: 8, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }}
            className="inline-block p-4 bg-gradient-to-r from-blue-500/10 to-purple-600/10 rounded-full border border-blue-500/20"
          >
            <Sparkles className="w-8 h-8 text-blue-500" />
          </motion.div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          {onHomeClick && (
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={onHomeClick}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-2 rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </motion.div>
          )}

          {showRetry && onRetryClick && (
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={onRetryClick}
                variant="outline"
                className="border-2 border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500 hover:text-white px-6 py-2 rounded-full font-medium transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </motion.div>
          )}
        </motion.div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 8 }, (_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full opacity-40"
              animate={{
                x: [0, 50, -50, 0],
                y: [0, -50, 50, 0],
                scale: [1, 0.5, 1],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{
                duration: 4 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3,
              }}
              style={{
                left: `${20 + i * 10}%`,
                top: `${30 + (i % 3) * 20}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}