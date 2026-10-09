import React from 'react';

export default function Skeleton({ className = "", ...props }) {
  return (
    <div 
      className={`animate-pulse bg-slate-200 dark:bg-slate-800/50 rounded-md ${className}`} 
      {...props}
    />
  );
}
