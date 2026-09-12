'use client'

import { EngineImage } from '@/src/engine/components/EngineImage'
import { useEffect, useMemo, useState } from 'react'
import type { City } from './data'
import { getRoavioCityImage } from './cityImages'
import { ROAVIO_MEDIA_VERSION } from './mediaVersion'

const imageExtensions = ['webp', 'jpg', 'jpeg', 'png'] as const

export function CityThumb({ city, className }: { city: City; className?: string }) {
  const candidates = useMemo(() => {
    const original = getRoavioCityImage(city.slug)
    const localFallbacks = imageExtensions.map(
      (extension) => `/city-media/${city.slug}.${extension}?v=${ROAVIO_MEDIA_VERSION}`,
    )

    return original ? [original, ...localFallbacks] : localFallbacks
  }, [city.slug])

  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [city.slug])

  const source = candidates[Math.min(activeIndex, candidates.length - 1)]

  return (
    <div
      data-roavio-city-image
      className={`relative overflow-hidden bg-[#10201b] ${className ?? ''}`.trim()}
    >
      <EngineImage
        key={`${city.slug}-${activeIndex}`}
        src={source}
        alt=""
        fill
        priority
        unoptimized
        sizes="(max-width: 640px) 78px, 96px"
        className="object-cover transition duration-300 group-hover:scale-[1.025]"
        onError={() => {
          setActiveIndex((current) => {
            if (current >= candidates.length - 1) return current
            return current + 1
          })
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#07100dcc] via-transparent to-transparent" />
    </div>
  )
}
