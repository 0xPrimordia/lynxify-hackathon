import React from 'react';

interface WeightBarProps {
  totalWeight: number;
}

export const WeightBar: React.FC<WeightBarProps> = ({ totalWeight }) => {
  const getBarColor = () => {
    if (totalWeight === 100) return 'bg-green-500';
    if (totalWeight > 100) return 'bg-red-500';
    return 'bg-blue-500';
  };

  return (
    <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
      <div
        className={`h-2.5 rounded-full transition-all duration-300 ${getBarColor()}`}
        style={{ width: `${Math.min(totalWeight, 100)}%` }}
      />
    </div>
  );
};