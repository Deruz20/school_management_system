import { useState } from 'react';
import { motion } from 'motion/react';
import { Download, Printer, Share2, Heart, MessageSquare, Search, BookOpen, X } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';

interface TopToolbarProps {
  onToggleSearch: () => void;
  searchOpen: boolean;
  onDownload: () => void;
  onPrint: () => void;
  onShare: () => void;
  reportCount: number;
}

const REACTIONS = ['👍', '❤️', '⭐', '🎉', '✅', '🔖'];

function IconBtn({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip.Provider delayDuration={350}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.1, y: -1 }}
            whileTap={{ scale: 0.93 }}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
              active
                ? 'bg-emerald-100 text-emerald-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-5 h-5" />
          </motion.button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="bg-slate-800 text-white px-2.5 py-1.5 rounded-lg shadow-xl"
            style={{ fontSize: 11 }}
            sideOffset={6}
          >
            {label}
            <Tooltip.Arrow className="fill-slate-800" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export function TopToolbar({ onToggleSearch, searchOpen, onDownload, onPrint, onShare, reportCount }: TopToolbarProps) {
  const [reactionOpen, setReactionOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const handleReact = (emoji: string) => {
    toast.success(`Reaction "${emoji}" added.`);
    setReactionOpen(false);
  };

  const handleFeedback = () => {
    if (!feedbackText.trim()) return;
    toast.success('Feedback submitted. Thank you!');
    setFeedbackText('');
    setFeedbackOpen(false);
  };

  return (
    <div className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shadow-sm flex-shrink-0" style={{ zIndex: 30 }}>
      {/* Branding */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-8 h-8 bg-emerald-700 rounded-xl flex items-center justify-center shadow-sm">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs text-slate-800 font-bold tracking-tight" style={{ lineHeight: 1 }}>Jiddah Islamic</p>
          <p className="text-xs mt-0.5 font-medium" style={{ color: '#047857', fontSize: 10, lineHeight: 1 }}>Report Engine</p>
        </div>
      </div>

      {reportCount > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full px-2.5 py-0.5"
          style={{ fontSize: 11 }}
        >
          {reportCount} report{reportCount !== 1 ? 's' : ''} loaded
        </motion.div>
      )}

      <div className="flex-1" />

      {/* Action Icons */}
      <div className="flex items-center gap-0.5">
        <IconBtn icon={Download} label="Download" onClick={onDownload} />
        <IconBtn icon={Printer} label="Print" onClick={onPrint} />
        <IconBtn icon={Share2} label="Share" onClick={onShare} />

        {/* React Popover */}
        <Tooltip.Provider delayDuration={350}>
          <Tooltip.Root>
            <Popover.Root open={reactionOpen} onOpenChange={setReactionOpen}>
              <Tooltip.Trigger asChild>
                <Popover.Trigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.1, y: -1 }}
                    whileTap={{ scale: 0.93 }}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                      reactionOpen ? 'bg-rose-50 text-rose-500' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Heart className="w-5 h-5" />
                  </motion.button>
                </Popover.Trigger>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="bg-slate-800 text-white px-2.5 py-1.5 rounded-lg shadow-xl" style={{ fontSize: 11 }} sideOffset={6}>
                  React
                  <Tooltip.Arrow className="fill-slate-800" />
                </Tooltip.Content>
              </Tooltip.Portal>
              <Popover.Portal>
                <Popover.Content
                  className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-2.5 flex gap-1"
                  style={{ zIndex: 50 }}
                  sideOffset={8}
                >
                  {REACTIONS.map(emoji => (
                    <motion.button
                      key={emoji}
                      whileHover={{ scale: 1.35, y: -4 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => handleReact(emoji)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
                      style={{ fontSize: 20 }}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                  <Popover.Arrow className="fill-white" style={{ filter: 'drop-shadow(0 -1px 0 #e2e8f0)' }} />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </Tooltip.Root>
        </Tooltip.Provider>

        {/* Feedback Dialog */}
        <Tooltip.Provider delayDuration={350}>
          <Tooltip.Root>
            <Dialog.Root open={feedbackOpen} onOpenChange={setFeedbackOpen}>
              <Tooltip.Trigger asChild>
                <Dialog.Trigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.1, y: -1 }}
                    whileTap={{ scale: 0.93 }}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                      feedbackOpen ? 'bg-emerald-50 text-emerald-500' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5" />
                  </motion.button>
                </Dialog.Trigger>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="bg-slate-800 text-white px-2.5 py-1.5 rounded-lg shadow-xl" style={{ fontSize: 11 }} sideOffset={6}>
                  Feedback
                  <Tooltip.Arrow className="fill-slate-800" />
                </Tooltip.Content>
              </Tooltip.Portal>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/25 backdrop-blur-sm" style={{ zIndex: 50 }} />
                <Dialog.Content
                  className="fixed bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
                  style={{ zIndex: 51, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-slate-800">Submit Feedback</Dialog.Title>
                    <Dialog.Close asChild>
                      <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="text-sm text-slate-500 mb-4 leading-relaxed">
                    Share your thoughts about a report card or the Report Center system.
                  </Dialog.Description>
                  <textarea
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    placeholder="Your feedback…"
                    rows={4}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <div className="flex gap-2 mt-4 justify-end">
                    <Dialog.Close asChild>
                      <button className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        Cancel
                      </button>
                    </Dialog.Close>
                    <button
                      onClick={handleFeedback}
                      disabled={!feedbackText.trim()}
                      className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit
                    </button>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-200 flex-shrink-0" />

      {/* Search Toggle */}
      <Tooltip.Provider delayDuration={350}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <motion.button
              onClick={onToggleSearch}
              whileHover={{ scale: 1.1, y: -1 }}
              whileTap={{ scale: 0.93 }}
              className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
                searchOpen ? 'bg-emerald-100 text-emerald-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <motion.div
                key={searchOpen ? 'x' : 'search'}
                initial={{ rotate: -15, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
              </motion.div>
            </motion.button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content className="bg-slate-800 text-white px-2.5 py-1.5 rounded-lg shadow-xl" style={{ fontSize: 11 }} sideOffset={6}>
              {searchOpen ? 'Close search' : 'Search & Filter'}
              <Tooltip.Arrow className="fill-slate-800" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  );
}
