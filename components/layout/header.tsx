'use client'

import { ThemeToggle } from '@/components/theme-toggle'
import { Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  title?: string
  staleItemsCount?: number
}

export function Header({ title, staleItemsCount = 0 }: HeaderProps) {
  return (
    <div className="hidden lg:flex items-center justify-between h-16 px-6 border-b border-border bg-background/95 backdrop-blur sticky top-0 z-30">
      {title && (
        <h1 className="text-lg font-semibold hidden lg:block">{title}</h1>
      )}
      <div className="flex-1 lg:flex-none" />
      <div className="flex items-center gap-2">
        {staleItemsCount > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="relative h-9 w-9 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Bell className="h-4 w-4" />
              <Badge
                variant="destructive"
                className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {staleItemsCount > 9 ? '9+' : staleItemsCount}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Alertas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {staleItemsCount} {staleItemsCount === 1 ? 'item parado' : 'itens parados'} há mais de 90 dias
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Verifique o estoque e considere reduzir os preços
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ThemeToggle />
      </div>
    </div>
  )
}
