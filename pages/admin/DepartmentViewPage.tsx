
import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { MarkdownRenderer } from '../../components/ai/MarkdownRenderer.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import type { AdminProfile, DepartmentAnnouncement } from '../../types.ts';
import { generateGoogleMeetLink } from '../../utils/meet.ts';
import toast from 'react-hot-toast';

interface DepartmentViewPageProps {
    user: AdminProfile;
}

interface SyllabusItem {
    id: string;
    subject: string;
    code: string;
    semester: number;
    url: string;
}

const fetchDepartmentAdmins = async (supabase: any, college: string, department: string) => {
    const { data, error } = await supabase.from('admins').select('*').eq('college', college).eq('department', department);
    if (error) throw error;

    return (data as AdminProfile[]).sort((a, b) => {
        if (a.role === 'HOD') return -1;
        if (b.role === 'HOD') return 1;
        return a.name.localeCompare(b.name);
    });
};

const fetchDepartmentAnnouncements = async (supabase: any, department: string) => {
    const { data, error } = await supabase.from('department_announcements').select('*').eq('department_id', department).order('created_at', { ascending: false });
    if (error) throw error;
    return data as DepartmentAnnouncement[];
};

const DepartmentViewPage: React.FC<DepartmentViewPageProps> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [activeSection, setActiveSection] = useState<'bulletin' | 'syllabus' | 'faculty'>('bulletin');

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });

    // In a real app, this would come from a 'department_syllabus' table
    const [syllabusItems] = useState<SyllabusItem[]>([
        { id: '1', subject: 'Machine Learning', code: 'CS401', semester: 7, url: '#' },
        { id: '2', subject: 'Cloud Computing', code: 'CS402', semester: 7, url: '#' },
        { id: '3', subject: 'Natural Language Processing', code: 'CS403', semester: 8, url: '#' },
        { id: '4', subject: 'Compiler Design', code: 'CS404', semester: 8, url: '#' },
    ]);

    // Meeting & MoM States
    const [meetingLink, setMeetingLink] = useState<string | null>(null);
    const [isMoMGenerating, setIsMoMGenerating] = useState(false);
    const [generatedMoM, setGeneratedMoM] = useState<string | null>(null);
    const [isMoMModalOpen, setIsMoMModalOpen] = useState(false);

    const { data: departmentAdmins = [], isLoading: isLoadingAdmins } = useQuery<AdminProfile[]>({
        queryKey: ['departmentAdmins', user.college, user.department],
        queryFn: () => fetchDepartmentAdmins(supabase, user.college, user.department || ''),
        enabled: !!user.department,
    });

    const { data: announcements = [], isLoading: isLoadingAnnouncements } = useQuery<DepartmentAnnouncement[]>({
        queryKey: ['departmentAnnouncements', user.department],
        queryFn: () => fetchDepartmentAnnouncements(supabase, user.department || ''),
        enabled: !!user.department,
    });

    const createAnnouncementMutation = useMutation({
        mutationFn: async (payload: { title: string, content: string }) => {
            const { error } = await supabase.from('department_announcements').insert({
                department_id: user.department,
                college_name: user.college,
                poster_id: user.id,
                poster_name: user.name,
                content: `### ${payload.title}\n\n${payload.content}`
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Circular broadcasted successfully!");
            queryClient.invalidateQueries({ queryKey: ['departmentAnnouncements', user.department] });
            setIsUploadModalOpen(false);
            setNewAnnouncement({ title: '', content: '' });
        },
        onError: (e: any) => toast.error(e.message)
    });

    if (!user.department) {
        return (
            <Card glow="none" className="text-center p-12">
                <h1 className="font-display text-4xl text-primary mb-4">University Level Hub</h1>
                <p className="text-lg text-text-muted">General administration access active. Specific department headquarters are available to HODs and respective Faculty.</p>
            </Card>
        );
    }

    const handleGenerateMeetLink = () => {
        const link = generateGoogleMeetLink();
        setMeetingLink(link);
        navigator.clipboard.writeText(link).then(() => {
            toast.success('Departmental Meeting link ready!', { icon: '🎥' });
        });
    };

    const handleGenerateMoM = async () => {
        setIsMoMGenerating(true);
        try {
            // Using existing generate-mom task from ai-handler
            const { data: aiResult, error } = await supabase.functions.invoke('ai-handler', {
                body: {
                    task: 'generate-mom',
                    payload: {
                        title: `Departmental Strategy Meet - ${user.department}`,
                        notes: `Discussion on Departmental Growth, Syllabus coverage for current semester, and Placement readiness for upcoming drives. Attendees: ${departmentAdmins.map(a => a.name).join(', ')}.`
                    }
                },
            });

            if (error) throw error;

            setGeneratedMoM(aiResult.text);
            setMeetingLink(null); // Conclude meeting
            setIsMoMModalOpen(true);
            toast.success("AI MoM generated successfully!", { icon: '📝' });
        } catch (error: any) {
            toast.error("MoM generation failed: " + error.message);
        } finally {
            setIsMoMGenerating(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 font-body">
            {/* Meeting Bridge (Visible when active) */}
            {meetingLink && (
                <div className="bg-secondary/10 border border-secondary/30 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary">
                            <span className="material-symbols-outlined">videocam</span>
                        </div>
                        <div>
                            <h3 className="font-display text-white text-sm uppercase tracking-wider">Active Meeting Bridge</h3>
                            <p className="text-secondary font-mono text-xs">{meetingLink}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => window.open(meetingLink, '_blank')}
                            className="text-[10px] h-8 border-secondary/20 hover:border-secondary"
                        >
                            Open Meet
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleGenerateMoM}
                            disabled={isMoMGenerating}
                            className="text-[10px] h-8"
                        >
                            {isMoMGenerating ? <Spinner /> : '🏁 Conclude & AI MoM'}
                        </Button>
                    </div>
                </div>
            )}
            {/* Dept Header */}
            <div className="bg-card-bg/40 border border-primary/30 p-6 rounded-2xl backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="font-display text-4xl text-secondary uppercase tracking-tight leading-none mb-2" style={{ textShadow: '0 2px 10px rgba(var(--color-secondary-rgb), 0.2)' }}>
                        {user.department}
                    </h1>
                    <p className="text-text-muted text-sm font-mono italic">Departmental Operations Command</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary" onClick={handleGenerateMeetLink} className="text-xs py-2 shadow-secondary">
                        🎥 Meetings
                    </Button>
                    <Button variant="primary" onClick={() => setIsUploadModalOpen(true)} className="text-xs py-2">
                        + New Circular
                    </Button>
                </div>
            </div>

            {/* Sub Navigation */}
            <div className="flex border-b border-white/10 mb-6 overflow-x-auto custom-scrollbar">
                {[
                    { id: 'bulletin', label: 'Circulars & Notices', icon: '📢' },
                    { id: 'syllabus', label: 'Syllabus Vault', icon: '📚' },
                    { id: 'faculty', label: 'Faculty Directory', icon: '👥' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSection(tab.id as any)}
                        className={`px-6 py-3 text-sm font-bold capitalize transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeSection === tab.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-white'}`}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* SECTION: BULLETIN BOARD */}
                    {activeSection === 'bulletin' && (
                        <Card glow="none" className="border-white/10 animate-fade-in-up">
                            <h2 className="font-display text-xl text-white mb-6 flex items-center gap-2">
                                <span>📢</span> Active Circulars
                            </h2>
                            {isLoadingAnnouncements ? <Spinner /> : announcements.length === 0 ? (
                                <div className="text-center py-16 opacity-30">
                                    <span className="text-6xl block mb-4">📭</span>
                                    <p className="italic">No circulars posted yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {announcements.map(ann => (
                                        <div key={ann.id} className="p-5 bg-white/5 rounded-xl border border-white/10 relative hover:border-primary/30 transition-colors">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                                                        {ann.poster_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-primary">{ann.poster_name}</p>
                                                        <p className="text-[10px] text-text-muted font-mono">{new Date(ann.created_at).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-black uppercase">Official</span>
                                            </div>
                                            <div className="text-sm text-text-base prose-sm prose-invert max-w-none">
                                                <MarkdownRenderer content={ann.content} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* SECTION: SYLLABUS VAULT */}
                    {activeSection === 'syllabus' && (
                        <Card glow="none" className="border-white/10 animate-fade-in-up">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="font-display text-xl text-white">Curriculum Repository</h2>
                                <Button variant="ghost" className="text-xs py-1 h-8">+ Upload Resource</Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {syllabusItems.map(item => (
                                    <div key={item.id} className="p-4 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center group hover:border-primary/50 transition-all">
                                        <div>
                                            <p className="font-bold text-white group-hover:text-primary transition-colors">{item.subject}</p>
                                            <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">{item.code} • Semester {item.semester}</p>
                                        </div>
                                        <Button variant="ghost" className="text-[10px] py-1 h-7 border-primary/20">View PDF</Button>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* SECTION: FACULTY DIRECTORY */}
                    {activeSection === 'faculty' && (
                        <Card glow="primary" className="border-primary/20 animate-fade-in-up">
                            <h2 className="font-display text-xl text-primary uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span>👥</span> Registered Faculty
                            </h2>
                            {isLoadingAdmins ? <Spinner /> : (
                                <div className="space-y-3">
                                    {departmentAdmins.map(admin => (
                                        <div key={admin.id} className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${admin.role === 'HOD' ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,255,255,0.1)]' : 'bg-black/40 border-white/5 hover:border-primary/30'}`}>
                                            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold ${admin.role === 'HOD' ? 'bg-primary text-black border-primary' : 'bg-primary/10 text-primary border-primary/30'}`}>
                                                {admin.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0 flex-grow">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-white truncate">{admin.name}</p>
                                                    {admin.role === 'HOD' && <span className="text-[8px] bg-primary text-black px-1.5 rounded font-black uppercase">Head</span>}
                                                </div>
                                                <p className="text-[10px] text-text-muted uppercase tracking-widest">{admin.role}</p>
                                            </div>
                                            {admin.id === user.id ? (
                                                <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded border border-green-500/30">YOU</span>
                                            ) : (
                                                <Button variant="ghost" className="text-[10px] py-1 h-7 border-primary/20 hover:border-primary">Sync</Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                </div>

                {/* Sidebar Stats */}
                <div className="space-y-6">
                    <Card glow="none" className="bg-primary/5 border-primary/20 p-6">
                        <h3 className="text-xs text-primary font-bold uppercase tracking-widest mb-4">Placement Pulse</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-[10px] text-text-muted uppercase mb-1">
                                    <span>Placed Students</span>
                                    <span className="text-white">0%</span>
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/5">
                                    <div className="bg-secondary h-full w-[0%] shadow-[0_0_10px_rgb(var(--color-secondary-rgb)/0.5)]"></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-text-muted uppercase mb-1">
                                    <span>High Package (10L+)</span>
                                    <span className="text-white">0%</span>
                                </div>
                                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden border border-white/5">
                                    <div className="bg-primary h-full w-[0%] shadow-[0_0_10px_rgb(var(--color-primary-rgb)/0.5)]"></div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card glow="none" className="bg-red-500/5 border-red-500/20 p-6">
                        <h3 className="text-xs text-red-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-xs">warning</span>
                            Academic Risk Radar
                        </h3>
                        <div className="space-y-3">
                            <p className="text-[10px] text-text-muted italic">Monitoring student performance for risks...</p>
                        </div>
                    </Card>

                    <div className="p-4 bg-secondary/5 border border-secondary/20 rounded-lg">
                        <h4 className="text-secondary font-bold text-xs uppercase tracking-widest mb-2">Notice System</h4>
                        <p className="text-xs text-text-muted leading-relaxed">
                            Announcements posted via the circular architect are visible on all departmental student dashboards instantly.
                        </p>
                    </div>
                </div>
            </div>

            {/* CIRCULAR CREATION MODAL */}
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Broadcast New Circular">
                <form onSubmit={(e) => { e.preventDefault(); createAnnouncementMutation.mutate(newAnnouncement); }} className="space-y-4">
                    <Input
                        name="title"
                        label="Announcement Title"
                        placeholder="e.g. Schedule for Internal Labs"
                        required
                        value={newAnnouncement.title}
                        onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                    />
                    <div>
                        <label className="block text-primary font-display text-sm mb-2">Message Body (Supports Markdown)</label>
                        <textarea
                            name="content"
                            className="w-full bg-input-bg border-2 border-primary/30 rounded p-3 h-48 text-sm text-text-base focus:border-primary outline-none custom-scrollbar"
                            placeholder="Detail your departmental notice here..."
                            required
                            value={newAnnouncement.content}
                            onChange={e => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                        />
                    </div>
                    <div className="p-3 bg-primary/10 rounded border border-primary/20 text-[10px] text-text-muted italic">
                        The circular will be published under the name of {user.name} ({user.role}).
                    </div>
                    <Button type="submit" className="w-full mt-4" disabled={createAnnouncementMutation.isPending}>
                        {createAnnouncementMutation.isPending ? <Spinner /> : '🚀 Launch Broadcast'}
                    </Button>
                </form>
            </Modal>

            {/* AI MoM DISPLAY MODAL */}
            <Modal isOpen={isMoMModalOpen} onClose={() => setIsMoMModalOpen(false)} title="AI-Generated Minutes of Meeting">
                <div className="max-h-[70vh] overflow-y-auto custom-scrollbar pr-2 mb-6">
                    {generatedMoM && <MarkdownRenderer content={generatedMoM} />}
                </div>
                <div className="flex gap-3">
                    <Button variant="ghost" onClick={() => {
                        const blob = new Blob([generatedMoM || ''], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `MoM_${user.department}_${new Date().toLocaleDateString()}.md`;
                        a.click();
                        toast.success("Downloaded as Markdown");
                    }} className="flex-1 text-xs">Download MD</Button>
                    <Button variant="primary" onClick={() => setIsMoMModalOpen(false)} className="flex-1 text-xs">Close</Button>
                </div>
            </Modal>
        </div>
    );
};

export default DepartmentViewPage;
