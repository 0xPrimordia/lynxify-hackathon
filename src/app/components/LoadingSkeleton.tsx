import React from 'react';

interface LoadingSkeletonProps {
  type: 'card' | 'list' | 'chart';
  count?: number;
}

export default function LoadingSkeleton({ type, count = 3 }: LoadingSkeletonProps) {
  switch (type) {
    case 'card':
      return (
        <div className="space-y-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      );
    case 'list':
      return (
        <div className="space-y-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      );
    case 'chart':
      return (
        <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
      );
    default:
      return null;
  }
} 