import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Printer, Share2, MessageSquare, Search, X, LayoutGrid, List } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';

interface TopToolbarProps {
  searchOpen: boolean;
  onSearchToggle: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onShare: () => void;
  reportCount: number;
  layout: 'single' | 'grid';
  onLayoutToggle: () => void;
  isGenerating?: boolean;
}

const EMOJIS = ['👍', '❤️', '⭐', '🎉', '✅', '🔖'];

export function TopToolbar({
  searchOpen,
  onSearchToggle,
  onDownload,
  onPrint,
  onShare,
  reportCount,
  layout,
  onLayoutToggle,
  isGenerating,
}: TopToolbarProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [chosenEmoji, setChosenEmoji] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        className="flex items-center gap-2 shrink-0"
        style={{
          height: 56,
          padding: '0 16px',
          background: 'white',
          borderBottom: `1px solid ${reportCount > 0 ? 'rgba(249,115,22,0.2)' : 'rgba(0,0,0,0.07)'}`,
          boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
          transition: 'border-color 0.3s',
        }}
      >
        {/* ── Brand ─────────────────────── */}
        <div className="flex items-center gap-2.5 mr-4">
          {/* Dual-tone icon */}
          <div className="relative w-8 h-8 rounded-lg overflow-hidden shadow-sm flex-shrink-0">
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #047857 0%, #059669 50%, #f97316 100%)' }} />
            <div className="relative z-10 flex items-center justify-center w-full h-full">
              <span style={{ fontSize: 16 }}>📋</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              Jiddah Islamic
            </div>
            <div style={{ fontSize: 10, color: '#059669', fontWeight: 600, lineHeight: 1.2 }}>
              Report Engine
            </div>
          </div>
        </div>

        {/* ── Reports loaded badge ───────── */}
        <AnimatePresence>
          {reportCount > 0 && (
            <motion.div
              className="flex items-center gap-1.5 rounded-full"
              style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: 700,
                color: '#ea580c',
              }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: isGenerating ? '#f97316' : '#22c55e',
                  display: 'inline-block',
                  boxShadow: `0 0 0 2px ${isGenerating ? '#fed7aa' : '#bbf7d0'}`,
                }}
              />
              {isGenerating ? 'Generating…' : `${reportCount} report${reportCount !== 1 ? 's' : ''} loaded`}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* ── Layout toggle ─────────────── */}
        {reportCount > 1 && (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <motion.button
                onClick={onLayoutToggle}
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 34, height: 34,
                  background: 'rgba(0,0,0,0.04)',
                  border: '1px solid rgba(0,0,0,0.07)',
                  cursor: 'pointer',
                  color: '#475569',
                }}
                whileHover={{ background: 'rgba(5,150,105,0.08)', color: '#047857' }}
                whileTap={{ scale: 0.92 }}
              >
                {layout === 'grid' ? <List size={16} /> : <LayoutGrid size={16} />}
              </motion.button>
            </Tooltip.Trigger>
            <TooltipContent>{layout === 'grid' ? 'Single scroll view' : 'Grid view'}</TooltipContent>
          </Tooltip.Root>
        )}

        {/* ── Download ──────────────────── */}
        <IconBtn
          icon={<Download size={16} />}
          tooltip="Download reports"
          onClick={onDownload}
          disabled={reportCount === 0}
        />

        {/* ── Print ─────────────────────── */}
        <IconBtn
          icon={<Printer size={16} />}
          tooltip="Print reports"
          onClick={onPrint}
          disabled={reportCount === 0}
        />

        {/* ── Share ─────────────────────── */}
        <IconBtn
          icon={<Share2 size={16} />}
          tooltip="Share link"
          onClick={onShare}
          disabled={reportCount === 0}
        />

        {/* ── Emoji reaction ────────────── */}
        <Popover.Root open={emojiOpen} onOpenChange={setEmojiOpen}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Popover.Trigger asChild>
                <motion.button
                  className="flex items-center justify-center rounded-lg"
                  style={{
                    width: 34, height: 34,
                    background: chosenEmoji ? 'rgba(249,115,22,0.1)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${chosenEmoji ? 'rgba(249,115,22,0.3)' : 'rgba(0,0,0,0.07)'}`,
                    cursor: 'pointer', fontSize: 16,
                  }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                >
                  {chosenEmoji ?? '😊'}
                </motion.button>
              </Popover.Trigger>
            </Tooltip.Trigger>
            <TooltipContent>React to this report</TooltipContent>
          </Tooltip.Root>

          <Popover.Content
            side="bottom"
            sideOffset={6}
            style={{
              background: 'white',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.1)',
              padding: 10,
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              display: 'flex', gap: 6,
              zIndex: 100,
            }}
          >
            {EMOJIS.map((e) => (
              <motion.button
                key={e}
                onClick={() => { setChosenEmoji(e); setEmojiOpen(false); }}
                style={{
                  width: 32, height: 32, fontSize: 18, cursor: 'pointer',
                  background: 'none', border: 'none', borderRadius: 8,
                }}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
              >
                {e}
              </motion.button>
            ))}
          </Popover.Content>
        </Popover.Root>

        {/* ── Feedback ──────────────────── */}
        <Dialog.Root open={feedbackOpen} onOpenChange={setFeedbackOpen}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Dialog.Trigger asChild>
                <motion.button
                  className="flex items-center justify-center rounded-lg"
                  style={{
                    width: 34, height: 34,
                    background: 'rgba(0,0,0,0.04)',
                    border: '1px solid rgba(0,0,0,0.07)',
                    cursor: 'pointer', color: '#475569',
                  }}
                  whileHover={{ background: 'rgba(5,150,105,0.08)', color: '#047857' }}
                  whileTap={{ scale: 0.92 }}
                >
                  <MessageSquare size={16} />
                </motion.button>
              </Dialog.Trigger>
            </Tooltip.Trigger>
            <TooltipContent>Send feedback</TooltipContent>
          </Tooltip.Root>

          <Dialog.Portal>
            <Dialog.Overlay style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 200,
            }} />
            <Dialog.Content style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: 'white', borderRadius: 16, padding: 28,
              width: 380, boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
              zIndex: 201,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Dialog.Title style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Send Feedback
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    <X size={18} />
                  </button>
                </Dialog.Close>
              </div>
              <textarea
                placeholder="Describe your experience or report an issue…"
                style={{
                  width: '100%', minHeight: 100, borderRadius: 10,
                  border: '1.5px solid #e2e8f0', padding: '10px 12px',
                  fontSize: 13, resize: 'none', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#059669'; }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                <Dialog.Close asChild>
                  <button style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b',
                  }}>
                    Cancel
                  </button>
                </Dialog.Close>
                <Dialog.Close asChild>
                  <button style={{
                    padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: 'none', background: '#059669', color: 'white', cursor: 'pointer',
                  }}>
                    Send
                  </button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* ── Divider ───────────────────── */}
        <div style={{ width: 1, height: 22, background: 'rgba(0,0,0,0.08)', margin: '0 4px' }} />

        {/* ── Search toggle ─────────────── */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <motion.button
              onClick={onSearchToggle}
              className="flex items-center gap-1.5 rounded-lg font-semibold"
              style={{
                padding: '0 14px',
                height: 34,
                background: searchOpen ? '#fff7ed' : 'rgba(0,0,0,0.04)',
                border: `1px solid ${searchOpen ? '#fed7aa' : 'rgba(0,0,0,0.07)'}`,
                cursor: 'pointer',
                color: searchOpen ? '#ea580c' : '#475569',
                fontSize: 13,
              }}
              whileHover={searchOpen ? {} : { background: 'rgba(5,150,105,0.08)', color: '#047857', borderColor: 'rgba(5,150,105,0.2)' }}
              whileTap={{ scale: 0.96 }}
            >
              <motion.span
                animate={{ rotate: searchOpen ? 90 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {searchOpen ? <X size={15} /> : <Search size={15} />}
              </motion.span>
              {searchOpen ? 'Close' : 'Filter'}
            </motion.button>
          </Tooltip.Trigger>
          <TooltipContent>{searchOpen ? 'Close filter panel' : 'Open search & filter'}</TooltipContent>
        </Tooltip.Root>
      </div>
    </Tooltip.Provider>
  );
}

function IconBtn({
  icon,
  tooltip,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <motion.button
          onClick={onClick}
          disabled={disabled}
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 34, height: 34,
            background: 'rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.07)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: disabled ? '#cbd5e1' : '#475569',
            opacity: disabled ? 0.5 : 1,
          }}
          whileHover={disabled ? {} : { background: 'rgba(5,150,105,0.08)', color: '#047857', borderColor: 'rgba(5,150,105,0.2)' }}
          whileTap={disabled ? {} : { scale: 0.9 }}
        >
          {icon}
        </motion.button>
      </Tooltip.Trigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip.Root>
  );
}

function TooltipContent({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip.Portal>
      <Tooltip.Content
        sideOffset={6}
        style={{
          background: '#0f172a',
          color: 'white',
          borderRadius: 6,
          padding: '5px 10px',
          fontSize: 11,
          fontWeight: 500,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 300,
        }}
      >
        {children}
        <Tooltip.Arrow style={{ fill: '#0f172a' }} />
      </Tooltip.Content>
    </Tooltip.Portal>
  );
}
