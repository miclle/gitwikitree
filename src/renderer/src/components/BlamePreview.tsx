import { useTranslation } from 'react-i18next'
import type { GitBlameLine, GitBlamePayload } from '../../../shared/types'

type BlameSegment = GitBlameLine & {
  lines: GitBlameLine[]
}

type BlameContributor = Pick<GitBlameLine, 'authorName' | 'authorEmail' | 'authorAvatarUrl'>

type BlameAgeRange = {
  oldest: number
  newest: number
}

function getBlameSegmentKey(line: GitBlameLine): string {
  return [line.shortHash, line.authorName, line.committedAt, line.subject].join('\0')
}

function getBlameSegments(lines: GitBlameLine[]): BlameSegment[] {
  const segments: BlameSegment[] = []

  for (const line of lines) {
    const lastSegment = segments.at(-1)

    if (lastSegment && getBlameSegmentKey(lastSegment) === getBlameSegmentKey(line)) {
      lastSegment.lines.push(line)
      continue
    }

    segments.push({ ...line, lines: [line] })
  }

  return segments
}

function getBlameTimestamp(line: GitBlameLine): number {
  const timestamp = new Date(line.committedAt).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function getBlameAgeRange(segments: BlameSegment[]): BlameAgeRange {
  const timestamps = segments.map(getBlameTimestamp).filter((timestamp) => timestamp > 0)

  if (timestamps.length === 0) {
    return { oldest: 0, newest: 0 }
  }

  return {
    oldest: Math.min(...timestamps),
    newest: Math.max(...timestamps)
  }
}

function getBlameAgeColor(weight: number): string {
  const clampedWeight = Math.min(1, Math.max(0, weight))
  const lightness = 30 + clampedWeight * 32

  return `hsl(28 86% ${lightness}%)`
}

function getBlameAgeStyle(line: GitBlameLine, range: BlameAgeRange): { backgroundColor: string } {
  if (range.oldest === range.newest) return { backgroundColor: getBlameAgeColor(0.72) }

  return {
    backgroundColor: getBlameAgeColor(
      (getBlameTimestamp(line) - range.oldest) / (range.newest - range.oldest)
    )
  }
}

function getBlameContributors(segments: BlameSegment[]): BlameContributor[] {
  const contributors = new Map<string, BlameContributor>()

  for (const segment of segments) {
    const key = segment.authorEmail || segment.authorName
    if (!contributors.has(key)) {
      contributors.set(key, {
        authorName: segment.authorName,
        authorEmail: segment.authorEmail,
        authorAvatarUrl: segment.authorAvatarUrl
      })
    }
  }

  return [...contributors.values()]
}

function formatBlameDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

function getBlameAvatarLabel(line: BlameContributor): string {
  const words = line.authorName.trim().split(/\s+/).filter(Boolean)

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

function getBlameAvatarStyle(line: BlameContributor): { backgroundColor: string } {
  const seed = line.authorEmail || line.authorName
  let hash = 0

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 360
  }

  return { backgroundColor: `hsl(${hash} 58% 38%)` }
}

function BlameAvatar({
  contributor,
  className = 'blame-avatar'
}: {
  contributor: BlameContributor
  className?: string
}): React.JSX.Element {
  if (contributor.authorAvatarUrl) {
    return (
      <img
        className={className}
        src={contributor.authorAvatarUrl}
        title={contributor.authorName}
        alt={contributor.authorName}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    )
  }

  return (
    <span
      className={className}
      style={getBlameAvatarStyle(contributor)}
      title={contributor.authorName}
      aria-label={contributor.authorName}
    >
      {getBlameAvatarLabel(contributor)}
    </span>
  )
}

export function BlamePreview({ blame }: { blame: GitBlamePayload }): React.JSX.Element {
  const { t } = useTranslation()
  const segments = getBlameSegments(blame.lines)
  const contributors = getBlameContributors(segments)
  const ageRange = getBlameAgeRange(segments)

  return (
    <div className="blame-preview" aria-label={t('preview.blame')}>
      <div className="blame-toolbar">
        <div className="blame-age-legend" aria-label={t('preview.ageLegend')}>
          <span>{t('preview.older')}</span>
          {Array.from({ length: 10 }, (_, index) => (
            <span
              className="blame-age-swatch"
              key={index}
              style={{ backgroundColor: getBlameAgeColor(index / 9) }}
            />
          ))}
          <span>{t('preview.newer')}</span>
        </div>
        <div
          className="blame-contributors"
          title={`${contributors.length} ${t('preview.contributors')}`}
        >
          <span className="blame-contributor-avatars" aria-hidden="true">
            {contributors.slice(0, 3).map((contributor) => (
              <BlameAvatar
                key={contributor.authorEmail || contributor.authorName}
                contributor={contributor}
                className="blame-avatar blame-contributor-avatar"
              />
            ))}
          </span>
          <span>
            {t('preview.contributors')}: {contributors.length}
          </span>
        </div>
      </div>
      <div className="blame-preview-shell">
        {segments.map((segment) => (
          <div className="blame-segment" key={`${segment.lineNumber}:${segment.shortHash}`}>
            <div
              className="blame-segment-meta"
              title={[
                segment.authorName,
                segment.authorEmail,
                segment.shortHash || t('preview.uncommitted'),
                segment.subject,
                formatBlameDate(segment.committedAt)
              ]
                .filter(Boolean)
                .join('\n')}
            >
              <span
                className="blame-age-indicator"
                style={getBlameAgeStyle(segment, ageRange)}
                aria-hidden="true"
              />
              <span className="blame-segment-date">{formatBlameDate(segment.committedAt)}</span>
              <BlameAvatar contributor={segment} />
              <span className="blame-segment-author">{segment.authorName}</span>
              <span className="blame-segment-subject" title={segment.subject}>
                {segment.subject}
              </span>
              <span className="blame-segment-commit">
                {segment.shortHash || t('preview.uncommitted')}
              </span>
            </div>
            <div className="blame-code-lines">
              {segment.lines.map((line) => (
                <div className="blame-code-line" key={`${line.lineNumber}:${line.shortHash}`}>
                  <pre className="blame-line-number" aria-hidden="true">
                    {line.lineNumber}
                  </pre>
                  <pre className="blame-line-content">{line.content || ' '}</pre>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
