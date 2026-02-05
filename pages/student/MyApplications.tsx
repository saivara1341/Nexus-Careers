
import React, { useState } from 'react';
import type { Application, StudentProfile } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pagination } from '../../components/ui/Pagination.tsx';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { runAI } from '../../services/aiClient.ts';

interface MyApplicationsProps {
    user: StudentProfile;
}

const PAGE_SIZE = 20;

// SUPER AGGRESSIVE COMPRESSION: Max 250px width, 0.4 quality.
// Ensures payload is minimal (<50KB) for stability.
const blobToBase64AndResize = (blob: Blob, maxWidth = 250): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                // Lower quality to 0.4 to drastically reduce size
                const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
                resolve(dataUrl.split(',')[1]);
            };
            img.onerror = (err) => reject(new Error("Failed to load image for resizing"));
        };
        reader.onerror = (error) => reject(error);
    });
};

const fetchApplications = async (supabase, userId: string, page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
        .from('applications')
        .select(`*, opportunity:opportunities(*)`, { count: 'exact' })
        .eq('student_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        handleAiInvocationError(error);
        throw new Error(error.message);
    }

    const mappedData = (data || []).map((app: any) => ({
        ...app,
        opportunity: app.opportunity ? {
            ...app.opportunity,
            pipeline_stages: app.opportunity.ai_analysis?.pipeline || ['Applied', 'Verification', 'Assessment', 'Interview', 'Offer']
        } : null
    }));

    return { data: mappedData as Application[] || [], count: count || 0 };
};

const verifyMilestoneProof = async (supabase, { app, user, proofFile, milestone }: { app: Application, user: StudentProfile, proofFile: File, milestone: string }) => {
    // 1. Set status to verifying to provide UI feedback
    await supabase.from('applications').update({ status: 'verifying' }).eq('id', app.id);

    try {
        const base64Data = await blobToBase64AndResize(proofFile);

        // 2. Call AI Client to verify the image
        const aiResult = await runAI({
            task: 'verify-milestone-proof',
            payload: {
                mimeType: 'image/jpeg',
                base64Data,
                companyName: app.opportunity?.company,
                milestone: milestone,
                applicationId: app.id,
                studentId: user.id
            },
            supabase
        });

        if (aiResult.success) {
            // 3. Success: Calculate Next Stage and Advance
            const pipeline = app.opportunity?.pipeline_stages || ['Applied', 'Verification', 'Assessment', 'Interview', 'Offer'];
            const currentIdx = pipeline.indexOf(milestone);
            let nextStage = milestone;

            // Advance to next stage if available
            if (currentIdx !== -1 && currentIdx < pipeline.length - 1) {
                nextStage = pipeline[currentIdx + 1];
            }

            // Determine appropriate status based on next stage
            let nextStatus = 'verified'; // Default for generic intermediate steps
            const lowerNext = nextStage.toLowerCase();
            if (lowerNext.includes('offer')) nextStatus = 'offered';
            else if (lowerNext.includes('hired') || lowerNext.includes('joined')) nextStatus = 'hired';
            else if (lowerNext.includes('interview')) nextStatus = 'shortlisted';
            else if (lowerNext.includes('assessment')) nextStatus = 'shortlisted';
            else if (lowerNext.includes('applied')) nextStatus = 'applied'; // Should rarely happen if advancing

            // Update Database with new stage
            await supabase.from('applications').update({
                status: nextStatus,
                current_stage: nextStage,
                rejection_reason: null // Clear any previous errors
            }).eq('id', app.id);

            // Award XP for progress - Reduced for balance
            const xpAward = lowerNext.includes('offer') ? 100 : 20;
            await supabase.rpc('award_xp', { user_id: user.id, xp_amount: xpAward });

            return { success: true, message: `Proof Validated! Advanced to ${nextStage}. (+${xpAward} XP)` };

        } else {
            // 4. Failure: Revert status and record rejection reason
            // We revert to 'applied' or keep the current stage's logical status, but add the reason
            await supabase.from('applications').update({
                status: 'applied', // Revert to a safe state so they can try again
                rejection_reason: aiResult.message
            }).eq('id', app.id);

            return { success: false, message: aiResult.message };
        }

    } catch (functionError: any) {
        // Critical Failure (Network/API crash): Revert status so user isn't stuck
        await supabase.from('applications').update({ status: 'applied' }).eq('id', app.id);
        throw functionError;
    }
};

// Expandable Card Component
interface ApplicationCardProps {
    app: Application;
    index: number;
    handleUploadClick: (app: Application, milestone: string) => void;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({ app, index, handleUploadClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const stages = app.opportunity?.pipeline_stages || ['Applied', 'Verification', 'Assessment', 'Interview', 'Offer'];
    const currentStage = app.current_stage || stages[0];
    const currentStageIndex = stages.indexOf(currentStage);
    const isCompleted = app.status === 'hired' || app.status === 'offered';

    const getStatusColor = (status: Application['status']) => {
        switch (status) {
            case 'verified':
            case 'shortlisted':
            case 'qualified':
            case 'offered':
            case 'hired':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'applied': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'pending_verification':
            case 'verifying':
                return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30 animate-pulse';
            case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    }

    return (
        <Card
            className={`border-primary/30 relative overflow-hidden transition-all duration-300 cursor-pointer ${isExpanded ? 'ring-1 ring-primary bg-primary/5' : 'hover:border-primary'}`}
            style={{ animationDelay: `${index * 50}ms` }}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 relative z-10">
                <div>
                    <h2 className="font-display text-2xl text-primary">{app.opportunity?.title || 'Opportunity Title'}</h2>
                    <h3 className="text-xl text-secondary">{app.opportunity?.company || 'Company Name'}</h3>
                </div>
                <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 text-sm font-bold rounded-full border capitalize ${getStatusColor(app.status)}`}>
                        {app.status.replace(/_/g, ' ')}
                    </span>
                    {/* Chevron */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-6 w-6 text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-6 pt-6 border-t border-white/10 animate-fade-in-up cursor-default" onClick={(e) => e.stopPropagation()}>
                    {/* Verification Zone */}
                    {app.status !== 'rejected' && !isCompleted && (
                        <div className="bg-gradient-to-r from-primary/10 to-transparent p-4 rounded-lg border border-primary/20 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 relative z-10">
                            <div>
                                <p className="text-xs text-primary font-bold uppercase tracking-widest mb-1">Current Milestone</p>
                                <p className="text-xl font-display text-white">{currentStage}</p>
                                <p className="text-xs text-text-muted mt-1">Upload proof to advance to the next stage.</p>
                            </div>

                            {app.status === 'verifying' ? (
                                <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-500/40">
                                    <Spinner />
                                    <span className="text-yellow-300 text-sm font-bold animate-pulse">AI Verifying...</span>
                                </div>
                            ) : (
                                <Button
                                    variant="primary"
                                    onClick={() => handleUploadClick(app, currentStage)}
                                    className="shadow-[0_0_15px_rgba(0,255,255,0.4)] animate-pulse"
                                >
                                    Upload Proof ⬆
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Desktop Pipeline */}
                    <div className="hidden md:block relative mt-4 px-4 pb-2">
                        <div className="absolute top-[14px] left-4 right-4 h-1 bg-white/10 -z-10 rounded-full"></div>
                        <div className="flex justify-between items-start">
                            {stages.map((stage, i) => {
                                const isActive = i === currentStageIndex;
                                const isPast = i < currentStageIndex;

                                return (
                                    <div key={stage} className="flex flex-col items-center relative group min-w-[80px]">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 z-10 ${isPast ? 'bg-green-500 border-green-500 text-black' :
                                                isActive ? 'bg-primary border-primary scale-125 shadow-[0_0_15px_rgba(0,255,255,0.6)]' :
                                                    'bg-card-bg border-white/20'
                                            }`}>
                                            {isPast ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                            ) : (
                                                <span className={`text-xs ${isActive ? 'text-black font-bold' : 'text-gray-500'}`}>{i + 1}</span>
                                            )}
                                        </div>
                                        <span className={`text-xs mt-2 font-display text-center max-w-[100px] ${isActive ? 'text-primary font-bold' : 'text-text-muted'
                                            }`}>{stage}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Mobile Pipeline */}
                    <div className="md:hidden mt-4 relative border-l-2 border-white/10 ml-4 pl-6 py-2 space-y-6">
                        {stages.map((stage, i) => {
                            const isActive = i === currentStageIndex;
                            const isPast = i < currentStageIndex;

                            return (
                                <div key={stage} className="relative">
                                    <div className={`absolute -left-[33px] top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-card-bg z-10 transition-colors duration-300 ${isPast ? 'border-green-500 bg-green-500 text-black' :
                                            isActive ? 'border-primary bg-primary shadow-[0_0_10px_rgba(0,255,255,0.6)] text-black' :
                                                'border-white/20 text-gray-500'
                                        }`}>
                                        {isPast ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        ) : <span className="text-[10px] font-bold">{i + 1}</span>}
                                    </div>

                                    <div className="flex flex-col items-start">
                                        <span className={`text-sm font-display uppercase tracking-wider ${isActive ? 'text-primary font-bold' : 'text-text-muted'}`}>
                                            {stage}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Failure Feedback Area */}
                    {app.rejection_reason && (
                        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4 animate-fade-in-up">
                            <div className="flex items-center gap-2 mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                <p className="text-red-400 text-sm font-bold uppercase tracking-wide">Verification Failed</p>
                            </div>
                            <p className="text-red-300 text-sm">{app.rejection_reason}</p>
                            <p className="text-xs text-red-400/60 mt-2">Please upload a clearer image or the correct document.</p>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

const MyApplications: React.FC<MyApplicationsProps> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedApp, setSelectedApp] = useState<Application | null>(null);
    const [selectedMilestone, setSelectedMilestone] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);

    const { data: applicationsData, isLoading } = useQuery<{ data: Application[]; count: number }, Error>({
        queryKey: ['applications', user.id, page],
        queryFn: () => fetchApplications(supabase, user.id, page),
        placeholderData: (previousData) => previousData,
    });

    const applications = applicationsData?.data ?? [];
    const count = applicationsData?.count ?? 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const proofVerificationMutation = useMutation({
        mutationFn: (vars: { app: Application, user: StudentProfile, proofFile: File, milestone: string }) => verifyMilestoneProof(supabase, vars),
        onSuccess: (data) => {
            if (data.success) {
                toast.success(data.message, { duration: 5000, icon: '🎉' });
                queryClient.invalidateQueries({ queryKey: ['userProfile'] });
            } else {
                toast.error(data.message, { duration: 5000 });
            }
            queryClient.invalidateQueries({ queryKey: ['applications', user.id] });
            setIsModalOpen(false);
        },
        onError: async (error: Error) => {
            handleAiInvocationError(error);
            queryClient.invalidateQueries({ queryKey: ['applications', user.id] });
        }
    });

    const handleUploadClick = (app: Application, milestone: string) => {
        setSelectedApp(app);
        setSelectedMilestone(milestone);
        setProofFile(null);
        setIsModalOpen(true);
    };

    const handleProofSubmit = () => {
        if (!selectedApp || !proofFile || !selectedMilestone) {
            toast.error("Please select a proof file.");
            return;
        }
        proofVerificationMutation.mutate({ app: selectedApp, user, proofFile, milestone: selectedMilestone });
    };

    if (isLoading && applications.length === 0) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    return (
        <div className="pb-24">
            <header className="mb-8 text-left">
                <h1 className="font-display text-3xl md:text-4xl font-black tracking-tighter uppercase mb-2">
                    <span className="text-primary">My</span> <span className="text-white opacity-80">Opportunities</span>
                </h1>
                <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                    Track your professional journey, manage submissions, and verify career milestones.
                </p>
            </header>
            <div className="space-y-6">
                {applications.length === 0 && (
                    <Card><p className="text-center text-lg text-text-muted">You haven't applied to any opportunities yet.</p></Card>
                )}
                {applications.map((app, index) => (
                    <ApplicationCard
                        key={app.id}
                        app={app}
                        index={index}
                        handleUploadClick={handleUploadClick}
                    />
                ))}
            </div>

            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Verify Milestone: ${selectedMilestone}`}>
                <div className="space-y-4">
                    <div className="bg-primary/10 p-4 rounded border border-primary/20">
                        <p className="text-lg font-bold text-primary mb-2">Upload Verification Proof</p>
                        <p className="text-sm text-text-muted">
                            To advance from <strong>{selectedMilestone}</strong>, please upload a valid screenshot (e.g., Email, Test Score, Portal Status).
                        </p>
                    </div>

                    <Input type="file" accept="image/*" onChange={e => setProofFile(e.target.files ? e.target.files[0] : null)} />

                    <Button onClick={handleProofSubmit} className="w-full" disabled={proofVerificationMutation.isPending || !proofFile}>
                        {proofVerificationMutation.isPending ? <Spinner /> : `Submit for AI Verification`}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default MyApplications;
