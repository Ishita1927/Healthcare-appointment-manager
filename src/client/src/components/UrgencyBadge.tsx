import React from 'react';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

interface UrgencyBadgeProps {
  level?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export const UrgencyBadge: React.FC<UrgencyBadgeProps> = ({ level = 'Low', size = 'md' }) => {
  const norm = (level || 'Low').toUpperCase();

  const isHigh = norm === 'HIGH';
  const isMedium = norm === 'MEDIUM';

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm font-semibold'
  }[size];

  if (isHigh) {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-red-100 text-red-800 border border-red-200 ${sizeClasses}`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
        </span>
        <AlertTriangle className="w-3.5 h-3.5" />
        High Urgency
      </span>
    );
  }

  if (isMedium) {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-100 text-amber-800 border border-amber-200 ${sizeClasses}`}>
        <Clock className="w-3.5 h-3.5 text-amber-600" />
        Medium Urgency
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 ${sizeClasses}`}>
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      Low Urgency
    </span>
  );
};
