import { motion } from 'motion/react';
import { Search, BookOpen } from 'lucide-react';

interface EmptyStateProps {
  onSearchOpen: () => void;
}

export function EmptyState({ onSearchOpen }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full select-none">
      {/* Background glow */}
      <motion.div
        className="absolute w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(5,150,105,0.07) 0%, transparent 70%)',
        }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Icon cluster */}
      <div className="relative mb-8">
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ background: 'rgba(5,150,105,0.1)', transform: 'scale(1.5)' }}
          animate={{ scale: [1.5, 1.65, 1.5], opacity: [0.6, 0.3, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="relative w-24 h-24 rounded-2xl flex items-center justify-center shadow-xl"
          style={{ background: 'linear-gradient(135deg, #047857 0%, #064e3b 100%)' }}
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <BookOpen size={40} color="white" strokeWidth={1.5} />
          <motion.div
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: '#f97316' }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          >
            <Search size={14} color="white" strokeWidth={2.5} />
          </motion.div>
        </motion.div>
      </div>

      {/* Arabic title */}
      <div
        className="mb-1"
        style={{
          fontFamily: "'Cairo', sans-serif",
          fontSize: 22,
          fontWeight: 800,
          color: '#047857',
          letterSpacing: 1,
          direction: 'rtl',
        }}
      >
        مركز التقارير
      </div>

      {/* Gold pill */}
      <div
        className="mb-5 px-4 py-1 rounded-full"
        style={{
          background: 'rgba(212,175,55,0.1)',
          border: '1px solid rgba(212,175,55,0.4)',
          color: '#92730b',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.05em',
        }}
      >
        JIDDAH ISLAMIC NURSERY &amp; PRIMARY SCHOOL
      </div>

      <h2
        className="mb-3 text-center"
        style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}
      >
        Report Cards Ready to Generate
      </h2>

      <p
        className="mb-8 text-center max-w-xs"
        style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}
      >
        Select a class or student, choose the Term and Phase, then click{' '}
        <strong style={{ color: '#047857' }}>Generate Reports</strong> to preview and download.
      </p>

      <motion.button
        onClick={onSearchOpen}
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-lg"
        style={{
          background: '#f97316',
          color: 'white',
          fontSize: 15,
          border: 'none',
          cursor: 'pointer',
        }}
        whileHover={{ scale: 1.04, backgroundColor: '#ea580c' }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <Search size={18} />
        Open Search &amp; Filter
      </motion.button>

      {/* Step hints */}
      <div className="mt-8 flex gap-6">
        {[
          { step: '1', label: 'Select class or students' },
          { step: '2', label: 'Choose Term & Phase' },
          { step: '3', label: 'Generate & Download' },
        ].map(({ step, label }) => (
          <div key={step} className="flex flex-col items-center gap-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold"
              style={{ background: 'rgba(5,150,105,0.12)', color: '#047857', fontSize: 13 }}
            >
              {step}
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', maxWidth: 80 }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
