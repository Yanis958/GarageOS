"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ children, content, className, side = "top" }: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2 before:top-full before:left-1/2 before:-translate-x-1/2 before:border-t-gray-900",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2 before:bottom-full before:left-1/2 before:-translate-x-1/2 before:border-b-gray-900",
    left: "right-full top-1/2 -translate-y-1/2 mr-2 before:left-full before:top-1/2 before:-translate-y-1/2 before:border-l-gray-900",
    right: "left-full top-1/2 -translate-y-1/2 ml-2 before:right-full before:top-1/2 before:-translate-y-1/2 before:border-r-gray-900",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            "absolute z-50 px-3 py-2 text-xs font-medium text-white bg-gray-900 dark:bg-gray-800 rounded-lg shadow-lg pointer-events-none",
            "max-w-xs break-words",
            positionClasses[side],
            "before:content-[''] before:absolute before:border-4 before:border-transparent",
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
