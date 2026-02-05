
import React from 'react';

interface AudioVisualizerProps {
  isActive: boolean;
  mode: 'listening' | 'speaking' | 'thinking' | 'idle';
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, mode }) => {
  return (
    <div className="flex items-center justify-center gap-1 h-16 w-full bg-black/20 rounded-lg border border-white/5 backdrop-blur-sm overflow-hidden">
      {mode === 'idle' && <span className="text-text-muted text-sm tracking-widest uppercase">Microphone Ready</span>}
      {mode === 'thinking' && (
        <div className="flex gap-2">
            <span className="w-3 h-3 bg-secondary rounded-full animate-bounce"></span>
            <span className="w-3 h-3 bg-secondary rounded-full animate-bounce [animation-delay:0.2s]"></span>
            <span className="w-3 h-3 bg-secondary rounded-full animate-bounce [animation-delay:0.4s]"></span>
        </div>
      )}
      {(mode === 'listening' || mode === 'speaking') && (
        <>
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className={`w-1 bg-gradient-to-t ${mode === 'listening' ? 'from-primary/50 to-primary' : 'from-secondary/50 to-secondary'} rounded-full transition-all duration-75 ease-in-out`}
              style={{
                height: isActive ? `${Math.random() * 100}%` : '10%',
                animation: isActive ? `sound-wave 0.5s infinite ${i * 0.05}s` : 'none'
              }}
            />
          ))}
        </>
      )}
      <style>{`
        @keyframes sound-wave {
          0%, 100% { height: 10%; opacity: 0.5; }
          50% { height: 80%; opacity: 1; }
        }
      `}</style>
    </div>
  );
};
