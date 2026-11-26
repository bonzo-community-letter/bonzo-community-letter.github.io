import { config } from '../config'
import { hashscanTopicUrl } from '../lib/hcs'

export function SiteFooter() {
  return (
    // Opaque, in the nav's colour: the wall of ids stops at the footer rather than
    // running under the last line of the page.
    <footer className="border-t border-rule/60 bg-page">
      {/* justify-end: the status word used to sit on the left, and with it gone the topic
          line keeps its place at the right instead of drifting over to the left margin. */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline justify-end gap-x-6 gap-y-2 px-4 py-7 sm:px-6">
        <span className="text-[0.6875rem] uppercase tracking-[0.14em] text-ink-faint">
          Signed on the Hedera Consensus Service
          {/* The topic a signature lands on, read from the build's own configuration —
              the one fact a reader can check afterwards, and it has to be the topic this
              build actually writes to, not one typed in by hand. */}
          {config.topicId ? (
            <>
              {' · '}
              <a
                href={hashscanTopicUrl(config.network, config.topicId)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono normal-case tracking-normal underline decoration-rule underline-offset-4 transition-colors hover:text-ink-soft hover:decoration-accent"
              >
                {config.topicId} ↗
              </a>
            </>
          ) : null}
        </span>
      </div>
    </footer>
  )
}
