
import React, { useState, useEffect } from 'react';

export interface BarChartData {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartData[];
}

export const BarChart: React.FC<BarChartProps> = ({ data }) => {
  const [tooltip, setTooltip] = useState<{ x: number, y: number, label: string, value: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger animation frame after mount
    requestAnimationFrame(() => setMounted(true));
  }, []);
  
  if (!data || data.length === 0) return (
      <div className="h-[300px] flex items-center justify-center text-text-muted text-sm italic border border-white/5 rounded-lg bg-white/5">
          No data available for visualization
      </div>
  );

  const maxValue = Math.max(...data.map(d => d.value)) || 1; // Avoid divide by zero
  const chartHeight = 250;
  const chartWidth = 600; // Increased internal width for better spacing
  const barWidth = (chartWidth / data.length) * 0.6; // Thinner bars
  const gap = (chartWidth / data.length) * 0.4;

  const handleMouseOver = (e: React.MouseEvent<SVGRectElement>, item: BarChartData) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const container = e.currentTarget.closest('div')?.getBoundingClientRect();
    if (!container) return;
    
    setTooltip({
      x: rect.left - container.left + rect.width / 2,
      y: rect.top - container.top - 10,
      label: item.label,
      value: item.value,
    });
  };

  return (
    <div className="relative w-full h-[300px] select-none" style={{ fontFamily: 'var(--font-body)' }}>
      <svg 
        viewBox={`0 0 ${chartWidth} ${chartHeight + 50}`} 
        className="w-full h-full overflow-visible" 
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--color-primary-rgb))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(var(--color-secondary-rgb))" stopOpacity="0.4" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = chartHeight - (tick * chartHeight);
            return (
                <g key={tick}>
                    <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                    <text x="-10" y={y + 4} textAnchor="end" className="fill-text-muted text-[10px] font-mono opacity-50">
                        {Math.round(tick * maxValue)}
                    </text>
                </g>
            );
        })}

        {/* Bars */}
        <g>
          {data.map((item, index) => {
            const targetHeight = (item.value / maxValue) * chartHeight;
            const barHeight = mounted ? targetHeight : 0; // Animate from 0
            const x = index * (barWidth + gap) + (gap / 2);
            const y = chartHeight - barHeight;

            return (
              <g key={item.label} className="group">
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, 2)} // Min height 2px for visibility
                  rx={4} // Rounded top
                  fill="url(#barGradient)"
                  className="transition-all duration-1000 ease-out hover:opacity-80 cursor-pointer"
                  onMouseOver={(e) => handleMouseOver(e, item)}
                  onMouseOut={() => setTooltip(null)}
                  style={{ transformOrigin: `center ${chartHeight}px` }}
                />
                
                {/* Reflection effect line */}
                <rect 
                    x={x + barWidth*0.2} 
                    y={y} 
                    width={barWidth*0.1} 
                    height={Math.max(barHeight, 2)} 
                    fill="rgba(255,255,255,0.2)" 
                    className="pointer-events-none transition-all duration-1000 ease-out"
                />

                {/* Label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="end"
                  transform={`rotate(-35, ${x + barWidth / 2}, ${chartHeight + 20})`}
                  className="fill-text-muted text-[10px] font-medium tracking-wide group-hover:fill-primary transition-colors"
                >
                  {item.label.length > 15 ? item.label.substring(0, 12) + '...' : item.label}
                </text>
              </g>
            );
          })}
        </g>
        
        {/* X Axis Line */}
        <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} className="stroke-primary/30" strokeWidth="2" />
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div 
          className="absolute z-50 pointer-events-none transition-opacity duration-200"
          style={{ 
            left: `${tooltip.x}px`, 
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-black/80 backdrop-blur-md border border-primary/40 rounded-lg px-4 py-2 shadow-[0_0_15px_rgba(var(--color-primary-rgb),0.3)]">
            <div className="font-bold text-white text-xs mb-1 whitespace-nowrap">{tooltip.label}</div>
            <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <span className="font-mono text-primary text-sm font-bold">{tooltip.value}</span>
                <span className="text-[10px] text-text-muted uppercase">Apps</span>
            </div>
          </div>
          {/* Tooltip Arrow */}
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-primary/40 mx-auto mt-[-1px]"></div>
        </div>
      )}
    </div>
  );
};
