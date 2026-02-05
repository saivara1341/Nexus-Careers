
import React, { useEffect } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import type { Opportunity } from '../../types.ts';
import { Spinner } from '../ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx'; 
import { useQuery } from '@tanstack/react-query';
import { MarkdownRenderer } from '../ai/MarkdownRenderer.tsx';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { runAI } from '../../services/aiClient.ts';
import { useChatContext } from '../../contexts/ChatContext.tsx';

interface OpportunityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: Opportunity;
}

const fetchAiAnalysis = async (supabase: any, opportunity: Opportunity): Promise<Exclude<Opportunity['ai_analysis'], null>> => {
    if (opportunity.ai_analysis) return opportunity.ai_analysis;

    const { data: freshOpp, error: fetchError } = await supabase
        .from('opportunities')
        .select('ai_analysis')
        .eq('id', opportunity.id)
        .single();
    
    if (!fetchError && freshOpp?.ai_analysis) return freshOpp.ai_analysis;

    const data = await runAI({
        task: 'opportunity-analysis',
        payload: {
            description: opportunity.description,
            company: opportunity.company,
            title: opportunity.title,
        },
        supabase: supabase
    });

    supabase
      .from('opportunities')
      .update({ ai_analysis: data })
      .eq('id', opportunity.id)
      .then(({ error: updateError }: any) => {
        if(updateError) console.error("Failed to cache AI analysis:", updateError);
      });

    return data;
};

export const OpportunityDetailModal: React.FC<OpportunityDetailModalProps> = ({ isOpen, onClose, opportunity }) => {
    const supabase = useSupabase();
    const { setContext } = useChatContext();

    useEffect(() => {
        if (isOpen) {
            setContext(`Viewing Opportunity: "${opportunity.title}" at "${opportunity.company}". 
            Description: ${opportunity.description.substring(0, 300)}...
            Min CGPA: ${opportunity.min_cgpa}.
            Deadline: ${new Date(opportunity.deadline).toLocaleDateString()}.`);
        } else {
            setContext("Opportunity Board");
        }
    }, [isOpen, opportunity, setContext]);

    const { data: aiAnalysis, isLoading: isLoadingAnalysis, isError: isAnalysisError, error: analysisError } = useQuery<Exclude<Opportunity['ai_analysis'], null>, Error>({
        queryKey: ['aiAnalysis', opportunity.id],
        queryFn: async () => {
            try {
                return await fetchAiAnalysis(supabase, opportunity);
            } catch (err: any) {
                const errorMessage = handleAiInvocationError(err);
                throw new Error(errorMessage);
            }
        },
        enabled: isOpen,
        staleTime: Infinity,
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={opportunity.title}>
            <h2 className="font-display text-2xl text-primary mb-2">{opportunity.company}</h2>
            <p className="text-text-muted mb-4">Apply by: {new Date(opportunity.deadline).toLocaleDateString()}</p>
            
            <h3 className="font-display text-xl text-secondary mb-2">Description</h3>
            <p className="text-text-base mb-4 whitespace-pre-wrap">{opportunity.description}</p>

            <h3 className="font-display text-xl text-secondary mb-2">Requirements</h3>
            <p className="text-text-base">Min CGPA: {opportunity.min_cgpa.toFixed(2)}</p>
            <p className="text-text-base mb-4">Allowed Departments: {opportunity.allowed_departments.join(', ')}</p>
            
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-t border-primary/30 pt-4 mt-4">
                <Button variant="primary" onClick={() => window.open(opportunity.apply_link, '_blank')} className="flex-grow">
                    Apply Now
                </Button>
                <Button variant="secondary" onClick={() => {/* TODO: Implement report */}} className="flex-grow">
                    Report Opportunity
                </Button>
            </div>

            <div className="mt-6 border-t border-primary/30 pt-4">
                <h3 className="font-display text-2xl text-primary mb-2">AI Analysis</h3>
                {isLoadingAnalysis ? (
                    <div className="flex justify-center p-4"><Spinner /></div>
                ) : isAnalysisError ? (
                    <p className="text-red-400">Error loading AI analysis: {analysisError?.message}</p>
                ) : aiAnalysis ? (
                    <div className="space-y-4 text-lg">
                        <div>
                            <h4 className="font-display text-xl text-secondary">Key Skills</h4>
                            <ul className="list-disc list-inside">
                                {aiAnalysis.key_skills?.map((skill, i) => <li key={i}>{skill}</li>)}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-display text-xl text-secondary">Resume Tips</h4>
                            <MarkdownRenderer content={aiAnalysis.resume_tips || ''} />
                        </div>
                        <div>
                            <h4 className="font-display text-xl text-secondary">Potential Interview Questions</h4>
                            <ol className="list-decimal list-inside">
                                {aiAnalysis.interview_questions?.map((q, i) => <li key={i}>{q}</li>)}
                            </ol>
                        </div>
                    </div>
                ) : (
                    <p className="text-text-muted">AI analysis not available yet.</p>
                )}
            </div>
        </Modal>
    );
};
