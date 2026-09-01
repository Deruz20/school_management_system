/** Map class name or section label to canonical section_type for subjects/marks. */
export function getSectionTypeFromClassName(section: string | null | undefined): string {
  if (!section) return 'unknown'
  const lower = section.toLowerCase().trim()

  if (lower.includes('nursery') || lower.includes('baby') || lower.includes('middle') || lower.includes('top')) {
    return 'nursery'
  }

  if (['p.1', 'p.2', 'p.3', 'p1', 'p2', 'p3'].includes(lower)) {
    return 'lower_primary'
  }

  if (['p.4', 'p.5', 'p.6', 'p.7', 'p4', 'p5', 'p6', 'p7'].includes(lower)) {
    return 'upper_primary'
  }

  if (['nursery', 'lower_primary', 'upper_primary'].includes(lower)) {
    return lower
  }

  return section
}

export function resolveSectionType(
  section: string | null | undefined,
  className?: string | null
): string {
  if (className) {
    const fromClass = getSectionTypeFromClassName(className)
    if (fromClass !== 'unknown' && fromClass !== className) return fromClass
    if (['nursery', 'lower_primary', 'upper_primary'].includes(fromClass)) return fromClass
  }
  if (section && ['nursery', 'lower_primary', 'upper_primary'].includes(section)) return section
  if (className) return getSectionTypeFromClassName(className)
  return section ? getSectionTypeFromClassName(section) : 'unknown'
}
