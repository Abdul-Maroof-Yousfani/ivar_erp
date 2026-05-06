'use client';

import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';

const funFacts = [
  // Light & Friendly
  "This page is on vacation. Permanently.",
  "Even our 404s are working hard.",
  "You've discovered a page that doesn't exist (yet).",
  "This URL went out for coffee and never came back.",
  "This page is playing hide and seek... and winning.",
  "Our page took a wrong turn at the internet.",
  "This page decided to become a mystery.",
  "The page you're looking for is in another castle.",
  "This URL is currently unavailable for comment.",
  "Page not found, but your sense of adventure is intact.",
  "This page went on a digital walkabout.",
  "Our page is having an identity crisis.",
  "This URL is taking a mental health day.",
  "The page escaped! We're still looking for it.",
  "This page is socially distancing from the internet.",

  // Tech / Developer Humor
  "404 errors have a 100% uptime.",
  "This page failed successfully.",
  "The server is fine. The page… not so much.",
  "This request returned undefined.",
  "Error 404: Page not found. Humor still intact.",
  "This page exists in a parallel universe.",
  "Console.log('Where did this page go?')",
  "This page threw an exception and never caught it.",
  "HTTP Status: 404. Mood Status: Confused.",
  "This page has been garbage collected.",
  "Null pointer exception: Page reference not found.",
  "This page is stuck in an infinite loop... somewhere else.",
  "The page you requested has been deprecated.",
  "This URL returned a promise that was never resolved.",
  "Stack overflow: Too many redirects to nowhere.",
  "This page is experiencing a runtime error.",
  "The requested resource has been moved to /dev/null.",

  // Product / Startup Style
  "Great products still have 404s.",
  "Every click teaches us something — this one too.",
  "You're closer than you think. Just not here.",
  "This page doesn't exist, but your journey continues.",
  "Innovation happens everywhere, except here.",
  "This URL is under construction... indefinitely.",
  "We're iterating on this page. Forever.",
  "This page is in our backlog. Very, very deep.",
  "User story: As a page, I want to exist. Status: Blocked.",
  "This page failed our A/B test. Permanently.",
  "We pivoted away from this page.",
  "This URL is not part of our MVP.",
  "This page didn't make it past the design review.",

  // Slightly Clever
  "This page exists only as a lesson.",
  "You found a shortcut to nowhere.",
  "Not all who wander find pages.",
  "This URL is no longer with us.",
  "You've reached the edge of our digital world.",
  "This page went to find itself and got lost.",
  "The page you seek is in another dimension.",
  "This URL has achieved enlightenment and disappeared.",
  "You've discovered the internet's best kept secret: nothing.",
  "This page is Schrödinger's content - it both exists and doesn't.",
  "The page you want is probably in the last place you'd look.",
  "This URL is playing hard to get.",
  "You've found the digital equivalent of a unicorn.",

  // Witty & Sarcastic
  "Congratulations! You've found our most exclusive page.",
  "This page is so exclusive, it doesn't even exist.",
  "You've unlocked the achievement: Master of Lost URLs.",
  "This page is on a need-to-know basis. You don't need to know.",
  "The page you're looking for is probably overrated anyway.",
  "This URL is having trust issues.",
  "You've reached the end of the internet. Just kidding.",
  "This page is in witness protection.",
  "The page you want is probably having lunch.",
  "This URL is currently in a meeting.",

  // Philosophical
  "If a page doesn't exist, did you really visit it?",
  "This page is contemplating its existence.",
  "In the grand scheme of the internet, this page chose not to be.",
  "This URL is exploring the concept of digital minimalism.",
  "The absence of this page is its greatest feature.",
  "This page is practicing the art of being invisible.",
  "Sometimes the best page is no page at all.",

  // Pop Culture References
  "This page has left the building.",
  "The page you're looking for is not the page you're looking for.",
  "This URL has gone to a farm upstate.",
  "Houston, we have a problem. The page is missing.",
  "This page has been snapped out of existence.",
  "The page is out there... somewhere in cyberspace.",
  "This URL is in another castle, princess.",

  // Meta Humor
  "This 404 page is working perfectly, though.",
  "At least this error page exists!",
  "You've successfully found our 404 page. Mission accomplished?",
  "This page is so meta, it's commenting on its own absence.",
  "The real treasure was the 404 pages we found along the way.",
  "Plot twist: You were looking for a 404 page all along.",

  // Time & Space
  "This page exists only on Tuesdays. Today is not Tuesday.",
  "The page you want is scheduled for next century.",
  "This URL is stuck in a time loop from 1999.",
  "The page you're looking for is in a different timezone.",
  "This page is currently traveling through time.",
  "Your page is in another dimension, probably having fun.",

  // Office & Work Humor (Perfect for HR system!)
  "This page called in sick today.",
  "The page you want is in a meeting until further notice.",
  "This URL is currently on its lunch break.",
  "The page has submitted its two weeks' notice.",
  "This page is working from home... permanently.",
  "Your requested page is in HR. Good luck.",
  "This URL is attending a mandatory training session.",
  "The page you want has been promoted to a different server.",
  "This page is currently in performance review.",
  "Your page is stuck in the approval process.",
];

export default function NotFound() {
  const router = useRouter();
  const [currentFact, setCurrentFact] = useState('');

  useEffect(() => {
    // Get a random fun fact on component mount
    const randomIndex = Math.floor(Math.random() * funFacts.length);
    setCurrentFact(funFacts[randomIndex]);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">

        {/* 404 Number */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.1
          }}
          className="mb-8"
        >
          <motion.h1
            className="text-8xl md:text-9xl font-bold text-foreground/90"
            whileHover={{
              scale: 1.02,
              transition: { duration: 0.2 }
            }}
          >
            4
            <motion.span
              animate={{
                rotate: [0, 8, -8, 0]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="inline-block text-primary"
            >
              0
            </motion.span>
            4
          </motion.h1>
        </motion.div>

        {/* Title and description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-8 space-y-3"
        >
          <h2 className="text-2xl font-semibold text-foreground">
            Page Not Found
          </h2>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist.
          </p>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <motion.div
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={() => router.push('/')}
              className="px-6"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </motion.div>

          <motion.div
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="px-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </motion.div>
        </motion.div>

        {/* Random Fun fact */}
        {currentFact && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mt-12 px-6 py-3 bg-card border border-border rounded-xl shadow-sm"
          >
            <motion.div
              className="flex items-center justify-center gap-3"

            >


              <p className="text-sm text-muted-foreground leading-relaxed text-center">
                {currentFact}
              </p>

            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}