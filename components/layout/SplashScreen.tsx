
import React from 'react';

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black z-[9999] overflow-hidden">
      {/* Background Gradient Spotlights */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] nexus-pulse"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-secondary/20 rounded-full blur-[120px] nexus-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="relative flex flex-col items-center w-full px-4">
        {/* NEXUS CORE ANIMATION */}
        <div className="relative w-32 h-32 mb-12">
            {/* Core Glow */}
            <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl nexus-pulse"></div>
            
            {/* Center Orb */}
            <div className="absolute inset-[35%] bg-white rounded-full shadow-[0_0_30px_#00ffff] nexus-pulse-fast"></div>

            {/* Orbital Rings */}
            <div className="absolute inset-0 border-2 border-primary/40 rounded-full border-t-transparent border-l-transparent nexus-spin"></div>
            <div className="absolute inset-[-10px] border border-secondary/30 rounded-full border-b-transparent border-r-transparent nexus-spin-reverse"></div>
            <div className="absolute inset-[10px] border border-white/20 rounded-full border-t-transparent nexus-spin-slow"></div>
        </div>

        {/* Text Animation */}
        <div className="text-center relative z-10 w-full">
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-[0.1em] text-transparent bg-clip-text bg-gradient-to-r from-primary via-white to-secondary nexus-gradient-text select-none whitespace-nowrap leading-tight">
                NEXUS CAREERS
            </h1>
            <p className="mt-2 text-text-muted text-[10px] md:text-sm font-student-label tracking-[0.4em] uppercase nexus-fade-in">
                System Initializing
            </p>
            <p className="mt-8 text-[9px] text-white/30 font-display tracking-[0.15em] uppercase nexus-fade-in-delayed">
                A Product of Siddhi Dynamics LLP
            </p>
        </div>

        {/* Loading Bar */}
        <div className="mt-10 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-secondary w-[50%] nexus-loading-bar"></div>
        </div>
      </div>

      <style>{`
        /* Standard CSS Animations for reliability */
        .nexus-spin { animation: spin 2s linear infinite; }
        .nexus-spin-reverse { animation: spin 3s linear infinite reverse; }
        .nexus-spin-slow { animation: spin 4s linear infinite; }
        
        .nexus-pulse { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .nexus-pulse-fast { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        
        .nexus-gradient-text { animation: gradient-shift 3s ease infinite; background-size: 200% 200%; }
        
        .nexus-fade-in { animation: fade-in 1s ease-out 0.5s forwards; opacity: 0; transform: translateY(10px); }
        .nexus-fade-in-delayed { animation: fade-in 1s ease-out 1.5s forwards; opacity: 0; transform: translateY(10px); }
        
        .nexus-loading-bar { animation: loading-slide 1.5s ease-in-out infinite alternate; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        
        @keyframes gradient-shift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        @keyframes fade-in { to { opacity: 1; transform: translateY(0); } }
        
        @keyframes loading-slide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
