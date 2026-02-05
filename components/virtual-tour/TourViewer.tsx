
import React, { useEffect, useRef } from 'react';
import type { CampusScene } from '../../types.ts';

declare global {
    interface Window {
        pannellum: any;
    }
}

interface TourViewerProps {
    scenes: CampusScene[];
    initialSceneId?: string;
    width?: string;
    height?: string;
    onSceneChange?: (sceneId: string) => void;
    // Editor Props
    isEditorMode?: boolean;
    onViewChange?: (pitch: number, yaw: number) => void;
}

export const TourViewer: React.FC<TourViewerProps> = ({ 
    scenes, 
    initialSceneId, 
    width = '100%', 
    height = '100%',
    onSceneChange,
    isEditorMode,
    onViewChange
}) => {
    const viewerRef = useRef<HTMLDivElement>(null);
    const viewerInstance = useRef<any>(null);

    useEffect(() => {
        if (!viewerRef.current || !window.pannellum || scenes.length === 0) return;

        // Convert our internal Scene structure to Pannellum's config structure
        const pannellumScenes: any = {};
        
        scenes.forEach(scene => {
            pannellumScenes[scene.id] = {
                title: scene.name,
                type: 'equirectangular',
                panorama: scene.imageUrl,
                pitch: scene.initialView?.pitch || 0,
                yaw: scene.initialView?.yaw || 0,
                hfov: scene.initialView?.hfov || 110,
                autoLoad: true,
                hotSpots: scene.hotspots.map(hs => ({
                    pitch: hs.pitch,
                    yaw: hs.yaw,
                    type: hs.type,
                    text: hs.text,
                    sceneId: hs.targetSceneId
                }))
            };
        });

        const config = {
            default: {
                firstScene: initialSceneId || scenes[0].id,
                sceneFadeDuration: 1000,
                autoLoad: true,
                orientationOnByDefault: false, // Enable gyroscope on mobile if supported
            },
            scenes: pannellumScenes
        };

        // Initialize viewer
        if (viewerInstance.current) {
            viewerInstance.current.destroy();
        }

        viewerInstance.current = window.pannellum.viewer(viewerRef.current, config);

        // Event Listeners
        viewerInstance.current.on('scenechange', (sceneId: string) => {
            if (onSceneChange) onSceneChange(sceneId);
        });

        if (isEditorMode && onViewChange) {
            // Poll for view changes in editor mode (Pannellum doesn't have a robust 'viewchange' event for everything)
            const interval = setInterval(() => {
                if (viewerInstance.current) {
                    const p = viewerInstance.current.getPitch();
                    const y = viewerInstance.current.getYaw();
                    onViewChange(p, y);
                }
            }, 500);
            return () => clearInterval(interval);
        }

        return () => {
            if (viewerInstance.current) {
                viewerInstance.current.destroy();
            }
        };
    }, [scenes, initialSceneId]); // Re-init if scenes change significantly

    return (
        <div 
            ref={viewerRef} 
            style={{ width, height }} 
            className="rounded-xl overflow-hidden shadow-2xl relative"
        />
    );
};
