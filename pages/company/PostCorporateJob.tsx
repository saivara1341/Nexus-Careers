
import React, { useState } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import type { CompanyProfile, Opportunity } from '../../types.ts';
import toast from 'react-hot-toast';
import { runAI } from '../../services/aiClient.ts';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';

const COLLEGES = ['Anurag University', 'CVR College of Engineering', 'VNR VJIET', 'GRIET'];

const PostCorporateJob: React.FC<{ user: CompanyProfile; onSuccess: () => void; onClose: () => void }> = ({ user, onSuccess, onClose }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [step, setStep] = useState(1);
    const [isGenerating, setIsGenerating] = useState(false);
    const [jdFile, setJdFile] = useState<File | null>(null);
    const [isAIFetchModalOpen, setIsAIFetchModalOpen] = useState(false);

    const [formData, setFormData] = useState<Partial<Opportunity>>({
        title: '',
        company: user.company_name,
        description: '',
        college: COLLEGES[0],
        min_cgpa: 6.0,
        deadline: '',
        pipeline_stages: ['Registration', 'Assessment', 'Interview', 'Offer']
    });

    const sanitizeDate = (date: string | undefined | null) => {
        if (!date || date.trim() === '') return null;
        try {
            return new Date(date).toISOString();
        } catch (e) {
            return null;
        }
    };

    const generateDescription = async () => {
        if (!formData.title) return toast.error("Enter a job title first.");
        setIsGenerating(true);
        try {
            const result = await runAI({
                task: 'chat',
                payload: { 
                    message: `Generate a professional job description for a "${formData.title}" role at "${user.company_name}" in the "${user.industry}" industry. Keep it under 200 words. Return plain text.`,
                    history: [] 
                },
                supabase
            });
            setFormData(prev => ({ ...prev, description: result.text }));
        } catch (e: any) { handleAiInvocationError(e); }
        finally { setIsGenerating(false); }
    };

    const handleAIFetchSuccess = (data: any) => {
        const defaultDeadline = new Date();
        defaultDeadline.setDate(defaultDeadline.getDate() + 30);
        
        let deadlineISOString = defaultDeadline.toISOString();
        if (data.deadline && /^\d{4}-\d{2}-\d{2}$/.test(data.deadline)) {
            deadlineISOString = new Date(data.deadline + 'T00:00:00Z').toISOString();
        }

        setFormData(prev => ({
            ...prev,
            title: data.title || prev.title,
            company: data.company || prev.company,
            description: data.description || prev.description,
            min_cgpa: data.min_cgpa || prev.min_cgpa,
            deadline: deadlineISOString.substring(0, 16),
            apply_link: data.apply_link || prev.apply_link,
            pipeline_stages: data.pipeline || prev.pipeline_stages
        }));
        setIsAIFetchModalOpen(false);
    };

    const postMutation = useMutation({
        mutationFn: async () => {
            if (!formData.title) throw new Error("Job Title is required.");
            if (!formData.description && !jdFile) throw new Error("Please provide a Job Description or upload a PDF.");

            let jdFileUrl = null;

            if (jdFile) {
                const fileName = `jds/${user.id}/${Date.now()}_${jdFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const { data: uploadData, error: uploadError } = await supabase.storage.from('opportunities').upload(fileName, jdFile);
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage.from('opportunities').getPublicUrl(fileName);
                jdFileUrl = urlData.publicUrl;
            }

            const finalDescription = formData.description || `Refer to attached JD for ${formData.title} at ${user.company_name}.`;

            // CRITICAL: Sanitize all date fields to prevent "" syntax error in PG
            const payload = {
                title: formData.title,
                company: formData.company,
                description: finalDescription,
                college: formData.college,
                min_cgpa: formData.min_cgpa,
                deadline: sanitizeDate(formData.deadline),
                assessment_start_date: sanitizeDate(formData.assessment_start_date),
                assessment_end_date: sanitizeDate(formData.assessment_end_date),
                interview_start_date: sanitizeDate(formData.interview_start_date),
                posted_by: user.id,
                is_corporate: true,
                allowed_departments: ['All'], 
                status: 'active',
                jd_file_url: jdFileUrl,
                ai_analysis: {
                    pipeline: formData.pipeline_stages,
                    key_skills: [],
                    resume_tips: 'Focus on relevant projects.',
                    interview_questions: []
                }
            };

            const { error } = await supabase.from('opportunities').insert(payload);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Opportunity posted successfully!");
            queryClient.invalidateQueries({ queryKey: ['companyJobs'] });
            onSuccess();
        },
        onError: (e: any) => toast.error(e.message)
    });

    const addStage = () => setFormData(prev => ({ ...prev, pipeline_stages: [...(prev.pipeline_stages||[]), "New Stage"] }));
    const updateStage = (idx: number, val: string) => {
        const newStages = [...(formData.pipeline_stages||[])];
        newStages[idx] = val;
        setFormData(prev => ({ ...prev, pipeline_stages: newStages }));
    };
    const removeStage = (idx: number) => {
        const newStages = [...(formData.pipeline_stages||[])].filter((_, i) => i !== idx);
        setFormData(prev => ({ ...prev, pipeline_stages: newStages }));
    };

    return (
        <Card glow="secondary" className="max-w-4xl mx-auto relative p-6">
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-text-muted hover:text-red-500 transition-colors p-2 z-10"
            >
                <span className="material-symbols-outlined">close</span>
            </button>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 pr-10">
                <div>
                    <h1 className="font-display text-2xl md:text-3xl text-primary">Post New Opportunity</h1>
                    <p className="text-text-muted text-sm">Targeting {formData.college}.</p>
                </div>
                <Button variant="secondary" className="text-xs py-1" onClick={() => setIsAIFetchModalOpen(true)}>✨ Import from URL</Button>
            </div>
            
            {step === 1 && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-primary font-display text-sm mb-2">Target College</label>
                            <select 
                                className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-2 text-sm text-text-base focus:ring-2 focus:ring-primary focus:outline-none"
                                value={formData.college}
                                onChange={e => setFormData({...formData, college: e.target.value})}
                            >
                                {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-primary font-display text-sm mb-2">Job Title</label>
                            <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. SDE-1" required className="text-sm" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start border-t border-b border-primary/10 py-6">
                        <div className="space-y-2 h-full flex flex-col">
                            <div className="flex flex-wrap justify-between items-end mb-2 gap-2">
                                <label className="block text-primary font-display text-sm">Description</label>
                                <Button variant="ghost" className="text-[10px] py-1 h-7" onClick={generateDescription} disabled={isGenerating}>
                                    {isGenerating ? <Spinner className="w-3 h-3"/> : '✨ AI Generate'}
                                </Button>
                            </div>
                            <textarea 
                                className="flex-grow w-full min-h-[120px] bg-input-bg border-2 border-primary/50 rounded-md p-3 text-sm text-text-base focus:outline-none"
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                                placeholder="Enter job details..."
                            />
                        </div>

                        <div className="space-y-2 h-full flex flex-col">
                            <label className="block text-primary font-display text-sm mb-2">OR Upload PDF</label>
                            <div className={`flex-grow border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center relative min-h-[120px] ${jdFile ? 'border-green-500 bg-green-500/5' : 'border-primary/30'}`}>
                                <input type="file" accept=".pdf" onChange={(e) => setJdFile(e.target.files ? e.target.files[0] : null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                {jdFile ? <p className="text-xs text-green-400 font-bold">{jdFile.name}</p> : <p className="text-xs text-text-muted">Click to Upload JD (PDF)</p>}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Deadline" type="datetime-local" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} required className="text-sm" />
                        <Input label="Min CGPA" type="number" step="0.1" value={formData.min_cgpa} onChange={e => setFormData({...formData, min_cgpa: parseFloat(e.target.value)})} className="text-sm" />
                    </div>

                    <Button className="w-full mt-4 text-sm" onClick={() => setStep(2)}>Next: Define Hiring Pipeline</Button>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="pt-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl text-primary font-display">Hiring Pipeline</h3>
                            <Button variant="ghost" onClick={addStage} className="text-xs border-dashed">+ Add Stage</Button>
                        </div>
                        <p className="text-xs text-text-muted mb-4">Define the steps candidates must complete (e.g., Registration, Assessment, Technical Interview).</p>
                        <div className="space-y-3">
                            {formData.pipeline_stages?.map((stage, idx) => (
                                <div key={idx} className="flex gap-3 items-center group">
                                    <span className="text-text-muted font-mono font-bold w-6">{idx + 1}.</span>
                                    <Input value={stage} onChange={e => updateStage(idx, e.target.value)} className="text-sm flex-grow" />
                                    <button onClick={() => removeStage(idx)} className="text-red-400 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <span className="material-symbols-outlined">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-8 border-t border-primary/10">
                        <Button variant="ghost" onClick={() => setStep(1)} className="flex-1 text-sm">Back</Button>
                        <Button variant="primary" onClick={() => postMutation.mutate()} disabled={postMutation.isPending} className="flex-1 text-sm">
                            {postMutation.isPending ? <Spinner/> : 'Launch Opportunity'}
                        </Button>
                    </div>
                </div>
            )}

            <AIFetchModal isOpen={isAIFetchModalOpen} onClose={() => setIsAIFetchModalOpen(false)} onSuccess={handleAIFetchSuccess} />
        </Card>
    );
};

const AIFetchModal: React.FC<{ isOpen: boolean; onClose: () => void; onSuccess: (data: any) => void; }> = ({ isOpen, onClose, onSuccess }) => {
    const supabase = useSupabase();
    const [link, setLink] = useState('');
    const scraperMutation = useMutation({
        mutationFn: async (url: string) => await runAI({ task: 'opportunity-link-scraper', payload: { url }, supabase }),
        onSuccess: (data) => {
            toast.success("AI fetched details!");
            onSuccess({ ...data, apply_link: link });
        },
        onError: (error: any) => handleAiInvocationError(error)
    });
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import via AI Agent">
            <div className="space-y-4">
                <p className="text-sm text-text-muted">The AI recruiter will scan the link to detect role title, description, and the most likely hiring pipeline stages.</p>
                <Input label="Job Link (LinkedIn/Naukri)" placeholder="https://..." value={link} onChange={e => setLink(e.target.value)} />
                <Button onClick={() => scraperMutation.mutate(link)} className="w-full" disabled={scraperMutation.isPending}>
                    {scraperMutation.isPending ? <Spinner/> : 'Scan URL'}
                </Button>
            </div>
        </Modal>
    );
};

export default PostCorporateJob;
