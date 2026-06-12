import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR })
}

export function formatDatetime(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatRelativeDate(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true })
}

export function formatMonth(date: string | Date): string {
  return format(new Date(date), 'MMM/yy', { locale: ptBR })
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function calculateROI(profit: number, investment: number): number {
  if (investment === 0) return 0
  return profit / investment
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    in_stock: 'Em Estoque',
    reserved: 'Reservado',
    sold: 'Vendido',
  }
  return labels[status] ?? status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    in_stock: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    reserved: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    sold: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-800'
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    cartao_credito: 'Cartão de Crédito',
    cartao_debito: 'Cartão de Débito',
    transferencia: 'Transferência',
    outro: 'Outro',
  }
  return labels[method] ?? method
}

export function projectSalesDate(
  itemsInStock: number,
  avgMonthlySales: number
): { months: number; date: Date } | null {
  if (avgMonthlySales <= 0) return null
  const months = itemsInStock / avgMonthlySales
  const date = new Date()
  date.setMonth(date.getMonth() + Math.ceil(months))
  return { months, date }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
