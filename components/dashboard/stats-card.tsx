import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'success' | 'warning' | 'info' | 'purple'
  className?: string
}

const variantStyles = {
  default: 'bg-card',
  success: 'bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20',
  warning: 'bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/20',
  info: 'bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20',
  purple: 'bg-gradient-to-br from-purple-500/10 to-violet-500/5 border-purple-500/20',
}

const iconStyles = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-green-500/10 text-green-600 dark:text-green-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}: StatsCardProps) {
  return (
    <Card className={cn('border transition-all hover:shadow-md', variantStyles[variant], className)}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight line-clamp-1">{title}</p>
            <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1 truncate">{value}</p>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 line-clamp-1">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                'flex items-center gap-1 mt-1 text-xs font-medium',
                trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}>
                <span>{trend.value >= 0 ? '▲' : '▼'}</span>
                <span>{Math.abs(trend.value).toFixed(1)}% {trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn('flex items-center justify-center w-8 h-8 sm:w-11 sm:h-11 rounded-xl shrink-0', iconStyles[variant])}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
