import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ReactNode } from "react"

interface ActionCardProps {
  title: string
  description?: string
  icon: ReactNode
  href: string
  isNew?: boolean
}

export default function ActionCard({ title, description, icon, href, isNew }: ActionCardProps) {
  return (
    <Link href={href} className="block">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-4 relative h-full">
        <div className="flex flex-col">
          <div className="mb-3 text-blue-600 dark:text-blue-500">
            {icon && (
              <div className="w-10 h-10 flex items-center justify-center">
                {icon}
              </div>
            )}
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-medium mb-1 text-black dark:text-white">{title}</h3>
              {description && <p className="text-slate-500 dark:text-slate-400 text-sm">{description}</p>}
            </div>
            <div className="text-blue-600 dark:text-blue-500">→</div>
          </div>

          {isNew && (
            <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
              NEW
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
