'use client'

import { useEffect, useRef, useState } from 'react'

interface PreviewScalerProps {
  children: React.ReactNode
  targetWidth: number
  targetHeight: number
}

export function PreviewScaler({ children, targetWidth, targetHeight }: PreviewScalerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width
        // Add a little padding so it doesn't touch the exact edges
        const availableWidth = containerWidth - 32
        if (availableWidth < targetWidth) {
          setScale(availableWidth / targetWidth)
        } else {
          setScale(1)
        }
      }
    })

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [targetWidth])

  const scaledHeight = targetHeight * scale

  return (
    <div 
      ref={containerRef} 
      className="w-full flex justify-center print:!block print:!w-auto print:!h-auto print:!overflow-visible"
      style={{ height: `${scaledHeight}px` }} 
    >
      <div 
        style={{ 
          transform: `scale(${scale})`, 
          transformOrigin: 'top center',
          width: `${targetWidth}px`,
          height: `${targetHeight}px`,
          imageRendering: 'auto',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          backfaceVisibility: 'hidden'
        }}
        className="print:!transform-none print:!w-full print:!h-full print:!m-0"
      >
        {children}
      </div>
    </div>
  )
}
