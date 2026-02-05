
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { TourViewer } from '../../components/virtual-tour/TourViewer.tsx';
import type { CampusScene, SceneHotspot } from '../../types.ts';
import toast from 'react-hot-toast';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';

// Mock data to simulate persistence
const MOCK_SCENES: CampusScene[] = [
    {
        id: 'main_gate',
        college: 'Anurag University',
        name: 'Main Gate',
        imageUrl: 'https://pannellum.org/images/alma.jpg', // Placeholder equirectangular
        hotspots: [],
        initialView: { pitch: 0, yaw: 0, hfov: 110 }
    }
];

export const VirtualTourEditor: React.FC = () => {
    const supabase = useSupabase();
    const [scenes, setScenes] = useState<CampusScene[]>(MOCK_SCENES);
    const [selectedSceneId, setSelectedSceneId] = useState<string>(MOCK_SCENES[0].id);
    const [isUploading, setIsUploading] = useState(false);
    
    // Editor State
    const [currentView, setCurrentView] = useState({ pitch: 0, yaw: 0 });
    const [hotspotTarget, setHotspotTarget] = useState('');
    const [hotspotText, setHotspotText] = useState('');

    const activeScene = scenes.find(s => s.id === selectedSceneId);

    // 1. Upload Logic
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // Mock upload - in real app, upload to Supabase Storage 'virtual-tour' bucket
            const fileName = `tour/${Date.now()}_${file.name}`;
            // const { data } = await supabase.storage.from('public').upload(fileName, file);
            // const url = supabase.storage.from('public').getPublicUrl(fileName).data.publicUrl;
            
            // Simulating a URL for demo purposes
            const mockUrl = URL.createObjectURL(file); 
            
            const newScene: CampusScene = {
                id: `scene_${Date.now()}`,
                college: 'Anurag University',
                name: file.name.replace(/\.[^/.]+$/, ""),
                imageUrl: mockUrl,
                hotspots: []
            };

            setScenes(prev => [...prev, newScene]);
            setSelectedSceneId(newScene.id);
            toast.success("Scene uploaded!");
        } catch (error) {
            toast.error("Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    // 2. Add Hotspot Logic
    const addHotspot = () => {
        if (!activeScene) return;
        if (!hotspotTarget) return toast.error("Select a target scene");

        const newHotspot: SceneHotspot = {
            id: `hs_${Date.now()}`,
            targetSceneId: hotspotTarget,
            pitch: currentView.pitch,
            yaw: currentView.yaw,
            text: hotspotText || "Go here",
            type: 'scene'
        };

        const updatedScenes = scenes.map(s => {
            if (s.id === selectedSceneId) {
                return { ...s, hotspots: [...s.hotspots, newHotspot] };
            }
            return s;
        });

        setScenes(updatedScenes);
        toast.success("Hotspot added! Rotate view to see it.");
        setHotspotText('');
    };

    // 3. Set Initial View
    const setInitialView = () => {
        const updatedScenes = scenes.map(s => {
            if (s.id === selectedSceneId) {
                return { ...s, initialView: { ...currentView, hfov: 110 } };
            }
            return s;
        });
        setScenes(updatedScenes);
        toast.success("Initial view saved.");
    };

    return (
        <div className="h-full flex flex-col md:flex-row gap-6 p-4">
            {/* LEFT PANEL: Scene Management */}
            <div className="w-full md:w-1/3 flex flex-col gap-6">
                <Card glow="primary" className="border-primary/20">
                    <h2 className="font-display text-2xl text-primary mb-4">Scene Manager</h2>
                    
                    <div className="mb-6">
                        <label className="block text-sm text-text-muted mb-2">Upload 360° Image (GoPro)</label>
                        <div className="flex gap-2">
                            <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                        </div>
                        {isUploading && <p className="text-xs text-secondary animate-pulse mt-1">Uploading...</p>}
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar bg-black/20 p-2 rounded">
                        {scenes.map(scene => (
                            <div 
                                key={scene.id}
                                onClick={() => setSelectedSceneId(scene.id)}
                                className={`p-3 rounded border cursor-pointer transition-all ${
                                    selectedSceneId === scene.id 
                                    ? 'bg-primary/20 border-primary text-white' 
                                    : 'bg-card-bg border-white/10 hover:border-white/30 text-text-muted'
                                }`}
                            >
                                <p className="font-bold text-sm">{scene.name}</p>
                                <p className="text-xs opacity-70">{scene.hotspots.length} links</p>
                            </div>
                        ))}
                    </div>
                </Card>

                {activeScene && (
                    <Card glow="secondary" className="border-secondary/20">
                        <h3 className="font-display text-lg text-secondary mb-3">Add Connection</h3>
                        <p className="text-xs text-text-muted mb-4">
                            1. Rotate the view on the right to where the arrow should be.<br/>
                            2. Select target scene.<br/>
                            3. Click Add.
                        </p>
                        
                        <div className="space-y-3">
                            <select 
                                className="w-full bg-input-bg border border-white/20 rounded p-2 text-sm text-white focus:border-secondary outline-none"
                                value={hotspotTarget}
                                onChange={(e) => setHotspotTarget(e.target.value)}
                            >
                                <option value="">-- Select Target Scene --</option>
                                {scenes.filter(s => s.id !== activeScene.id).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            
                            <Input 
                                placeholder="Label (e.g. To Library)" 
                                value={hotspotText} 
                                onChange={(e) => setHotspotText(e.target.value)} 
                            />

                            <div className="flex gap-2">
                                <div className="bg-black/30 p-2 rounded text-xs text-text-muted flex-1">
                                    Pitch: {currentView.pitch.toFixed(1)}<br/>
                                    Yaw: {currentView.yaw.toFixed(1)}
                                </div>
                                <Button onClick={addHotspot} className="flex-1">Add Link</Button>
                            </div>
                            
                            <Button variant="ghost" onClick={setInitialView} className="w-full text-xs">Set Current View as Start</Button>
                        </div>
                    </Card>
                )}
            </div>

            {/* RIGHT PANEL: Viewer */}
            <div className="w-full md:w-2/3 h-[500px] md:h-auto bg-black rounded-xl border border-white/10 overflow-hidden relative">
                {scenes.length > 0 ? (
                    <TourViewer 
                        scenes={scenes} 
                        initialSceneId={selectedSceneId}
                        isEditorMode={true}
                        onViewChange={(p, y) => setCurrentView({ pitch: p, yaw: y })}
                        onSceneChange={setSelectedSceneId}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-text-muted">
                        No scenes uploaded yet.
                    </div>
                )}
                
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded text-xs text-white pointer-events-none">
                    Editor Mode
                </div>
            </div>
        </div>
    );
};
