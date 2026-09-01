import { motion, AnimatePresence } from 'motion/react';
import { ZoomOut, ZoomIn, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';

interface FloatingControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitScreen: () => void;
  totalReports?: number;
  activeIndex?: number;
  onNavigate?: (index: number) => void;
}

export function FloatingControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitScreen,
  totalReports = 0,
  activeIndex = 0,
  onNavigate,
}: FloatingControlsProps) {
  const canPrev = activeIndex > 0;
  const canNext = activeIndex < totalReports - 1;

  return (
    <motion.div
      className="absolute bottom-5 left-1/2 flex items-center gap-1 rounded-2xl shadow-2xl"
      style={{
        transform: 'translateX(-50%)',
        background: 'rgba(15,23,42,0.93)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        padding: '6px 10px',
      }}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 28 }}
    >
      <AnimatePresence>
        {totalReports > 1 && (
          <motion.div
            className="flex items-center gap-1"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
          >
            <PillBtn onClick={() => onNavigate?.(activeIndex - 1)} disabled={!canPrev} title="Previous">
              <ChevronLeft size={15} />
            </PillBtn>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#f97316', padding: '0 8px' }}>
              {activeIndex + 1} / {totalReports}
            </span>
            <PillBtn onClick={() => onNavigate?.(activeIndex + 1)} disabled={!canNext} title="Next">
              <ChevronRight size={15} />
            </PillBtn>
            <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
          </motion.div>
        )}
      </AnimatePresence>

      <PillBtn onClick={onZoomOut} disabled={zoom <= 0.5} title="Zoom out">
        <ZoomOut size={16} />
      </PillBtn>

      <motion.button
        onClick={onFitScreen}
        title="Reset to 100%"
        style={{
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '4px 12px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          color: 'white',
          cursor: 'pointer',
          minWidth: 52,
        }}
        whileHover={{ background: 'rgba(255,255,255,0.14)' }}
        whileTap={{ scale: 0.94 }}
      >
        {Math.round(zoom * 100)}%
      </motion.button>

      <PillBtn onClick={onZoomIn} disabled={zoom >= 2} title="Zoom in">
        <ZoomIn size={16} />
      </PillBtn>

      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />

      <PillBtn onClick={onFitScreen} title="Fit to screen">
        <Maximize2 size={15} />
      </PillBtn>
    </motion.div>
  );
}

function PillBtn({
  onClick,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 30,
        height: 30,
        background: 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      whileHover={disabled ? {} : { background: 'rgba(255,255,255,0.1)' }}
      whileTap={disabled ? {} : { scale: 0.9 }}
    >
      {children}
    </motion.button>
  );
}
