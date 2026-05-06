'use client';

import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ErrorBoundaryProps {
  error?: Error;
  reset?: () => void;
  onHomeClick?: () => void;
  title?: string;
  subtitle?: string;
  showDetails?: boolean;
}

export function ErrorBoundary({
  error,
  reset,
  onHomeClick,
  title = "Something went wrong",
  subtitle = "An unexpected error occurred",
  showDetails = false,
}: ErrorBoundaryProps) {
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [pulseActive, setPulseActive] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseActive(prev => !prev);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
      {/* Animated background elements */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-32 h-32 bg-red-400/10 rounded-full blur-2xl"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      <motion.div
        className="absolute bottom-1/3 right-1/3 w-24 h-24 bg-orange-400/10 rounded-full blur-2xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.4, 0.2, 0.4],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />

      <div className="text-center z-10 px-4 max-w-2xl mx-auto">
        {/* Error icon with pulse animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <motion.div
            animate={{
              scale: pulseActive ? [1, 1.1, 1] : 1,
            }}
            transition={{
              duration: 1,
              ease: "easeInOut",
            }}
            className="inline-block p-6 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-full border-2 border-red-500/20"
          >
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </motion.div>
        </motion.div>

        {/* Title with slide animation */}
        <motion.h1
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-200 mb-4"
        >
          {title}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-lg text-gray-600 dark:text-gray-400 mb-8"
        >
          {subtitle}
        </motion.p>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6"
        >
          {reset && (
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={reset}
                className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white px-6 py-2 rounded-full font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </motion.div>
          )}

          {onHomeClick && (
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={onHomeClick}
                variant="outline"
                className="border-2 border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white px-6 py-2 rounded-full font-medium transition-all duration-300"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </motion.div>
          )}
        </motion.div>

        {/* Error details toggle */}
        {showDetails && error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            className="mt-6"
          >
            <Button
              onClick={() => setShowErrorDetails(!showErrorDetails)}
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Bug className="w-4 h-4 mr-2" />
              {showErrorDetails ? 'Hide' : 'Show'} Error Details
            </Button>

            {showErrorDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left overflow-auto max-h-40"
              >
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {error.message}
                  {error.stack && (
                    <>
                      {'\n\nStack trace:\n'}
                      {error.stack}
                    </>
                  )}
                </pre>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Floating error particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 6 }, (_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-red-400 rounded-full opacity-50"
              animate={{
                x: [0, 30, -30, 0],
                y: [0, -30, 30, 0],
                scale: [1, 0.5, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.2,
              }}
              style={{
                left: `${30 + i * 8}%`,
                top: `${40 + (i % 2) * 20}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}