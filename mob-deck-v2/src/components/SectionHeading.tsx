import type { ReactNode } from 'react'

type SectionHeadingProps = {
  eyebrow: string
  title: string
  compact?: boolean
  action?: ReactNode
}

export function SectionHeading({ eyebrow, title, compact = false, action }: SectionHeadingProps) {
  return (
    <div className={`section-heading${compact ? ' compact' : ''}`}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  )
}
