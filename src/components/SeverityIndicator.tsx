import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  OctagonAlert,
  ShieldAlert,
} from 'lucide-react';
import type { AqiCategoryInfo } from '../types/airwise';
import { getSeverityStyle } from '../utils/airQualityHelpers';

interface SeverityIndicatorProps {
  level: AqiCategoryInfo['level'];
  label: string;
  compact?: boolean;
}

export function SeverityIndicator({ level, label, compact = false }: SeverityIndicatorProps) {
  const style = getSeverityStyle(level);

  const renderIcon = () => {
    const iconClass = compact ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0';
    switch (level) {
      case 'good':
        return <CheckCircle2 className={iconClass} aria-hidden="true" />;
      case 'moderate':
        return <Info className={iconClass} aria-hidden="true" />;
      case 'sensitive':
        return <AlertTriangle className={iconClass} aria-hidden="true" />;
      case 'unhealthy':
      case 'very-unhealthy':
        return <ShieldAlert className={iconClass} aria-hidden="true" />;
      case 'hazardous':
        return <OctagonAlert className={iconClass} aria-hidden="true" />;
      default:
        return <HelpCircle className={iconClass} aria-hidden="true" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${
        compact ? 'text-xs' : 'text-sm'
      } ${style.textClass}`}
    >
      {renderIcon()}
      <span>{label}</span>
    </span>
  );
}
