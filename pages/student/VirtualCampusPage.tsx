
import React, { useEffect, useRef } from 'react';
import { Button } from '../../components/ui/Button.tsx';

/**
 * VirtualCampusPage - Uses the official CloudPano script injection method
 * to ensure all platform features and permissions are correctly loaded.
 */
export const VirtualCampusPage: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const tourId = "Z4YJiffhPHLf";
    const tourUrl = `https://app.cloudpano.com/tours/${tourId}`;

    useEffect(() => {
        // Clear previous content
        if (containerRef.current) {
            containerRef.current.innerHTML = '';

            // Create the div structure required by the CloudPano script
            const tourDiv = document.createElement('div');
            tourDiv.id = tourId;
            containerRef.current.appendChild(tourDiv);

            // Create and inject the script
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.src = "https://app.cloudpano.com/public/shareScript.js";
            script.setAttribute('data-short', tourId);
            script.setAttribute('data-path', 'tours');
            script.setAttribute('data-is-self-hosted', 'undefined');
            script.setAttribute('width', '100%');
            script.setAttribute('height', '100%'); // Fill the parent container

            tourDiv.appendChild(script);
        }

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [tourId]);

    return (
        <div className="h-screen flex flex-col bg-black relative">
            {/* Header Overlay */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-center pointer-events-none">
                <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-1 drop-shadow-lg pointer-events-auto text-primary">
                        Virtual Campus
                    </h1>
                    <div className="flex items-center gap-2 pointer-events-auto">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <p className="text-white/60 text-[10px] font-mono tracking-widest uppercase">Live Interactive 360° Tour</p>
                    </div>
                </div>
                <div className="pointer-events-auto hidden md:block">
                    <Button
                        variant="ghost"
                        className="bg-black/40 backdrop-blur-md border-white/20 hover:bg-white/10 text-xs"
                        onClick={() => window.open(tourUrl, '_blank')}
                    >
                        Open Direct Link
                    </Button>
                </div>
            </div>

            {/* Viewer Container - The script will inject the iframe here */}
            <div ref={containerRef} className="flex-1 w-full h-full relative overflow-hidden bg-gray-900">
                {/* Fallback loader / placeholder while script runs */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
                    <p className="font-mono text-xs tracking-widest uppercase">Initializing Virtual Environment...</p>
                </div>
            </div>

            {/* Mobile Actions Overlay */}
            <div className="md:hidden absolute bottom-20 left-4 right-4 z-10 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 pointer-events-auto">
                    <p className="text-[10px] text-text-muted uppercase tracking-widest mb-2 text-center font-bold">Experiencing issues?</p>
                    <Button
                        variant="primary"
                        className="w-full text-xs py-2 h-9"
                        onClick={() => window.open(tourUrl, '_blank')}
                    >
                        Open Full Screen
                    </Button>
                </div>
            </div>

            <style>{`
                /* Ensure the injected iframe fills the container */
                #${tourId} iframe {
                    width: 100% !important;
                    height: 100% !important;
                    position: absolute;
                    top: 0;
                    left: 0;
                    border: none !important;
                }
                #${tourId} {
                    width: 100%;
                    height: 100%;
                }
            `}</style>
        </div>
    );
};

export default VirtualCampusPage;
