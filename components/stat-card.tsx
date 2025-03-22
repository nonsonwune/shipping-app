import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ReactNode } from "react"

interface StatCardProps {
  icon?: string | ReactNode
  title: string
  value: string
  period?: string
  actionLabel?: string
  actionHref?: string
  trend?: string
}

export default function StatCard({ icon, title, value, period, actionLabel, actionHref, trend }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="text-blue-600 dark:text-blue-500">
            {typeof icon === 'string' ? (
              <Image src={icon || "/placeholder.svg"} alt={title} width={40} height={40} />
            ) : (
              <div className="w-10 h-10 flex items-center justify-center">
                {icon}
              </div>
            )}
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">{title}</p>
            <h3 className="text-xl font-bold text-black dark:text-white">{value}</h3>
            {trend && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{trend}</p>}
          </div>
        </div>

        {period && (
          <div className="border rounded-md px-3 py-1 text-sm border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">
              {period} <span className="ml-1">▼</span>
            </span>
          </div>
        )}
      </div>

      {actionLabel && actionHref && (
        <div className="mt-4">
          <Button className="w-full">{actionLabel}</Button>
        </div>
      )}
    </div>
  )
}
