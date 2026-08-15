import { Orbit } from 'lucide-react'

type BrandLockupProps = {
  compact?: boolean
}

export function BrandLockup({ compact = false }: BrandLockupProps) {
  return (
    <div className="brand-lockup">
      <span className="brand-orbit" aria-hidden="true">
        <Orbit size={20} />
      </span>
      {!compact && (
        <div>
          <strong>Gravity</strong>
          <span>Deck - Desktop</span>
        </div>
      )}
    </div>
  )
}
