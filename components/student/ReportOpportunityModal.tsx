import React, { useState } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import type { Opportunity, StudentProfile, OpportunityReport } from '../../types.ts';
import { useSupabase } from '../../contexts/SupabaseContext.tsx'; // Import useSupabase

interface ReportOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: Opportunity;
  user: StudentProfile;
}

export const ReportOpportunityModal: React.FC<ReportOpportunityModalProps> = ({ isOpen, onClose, opportunity, user }) => {
    const supabase = useSupabase(); // Use the Supabase client from context
    const [reason, setReason] = useState<OpportunityReport['reason'] | ''>('');
    const [comments, setComments] = useState('');
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason) {
            alert("Please select a reason for the report.");
            return;
        }
        setLoading(true);
        setFeedback('');

        try {
            // We use an RPC function to handle the report and check the threshold atomically.
            // This is more robust than doing multiple client-side queries.
            const { error } = await supabase.rpc('handle_opportunity_report', {
                opportunity_id: opportunity.id,
                reporter_id: user.id,
                report_reason: reason,
                report_comments: comments,
                college_name: user.college
            });
            
            if (error) throw error;
            
            setFeedback("Thank you for your feedback! The administrators have been notified.");
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (error: any) {
            setFeedback("Error submitting report: " + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Report: ${opportunity.title}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                {feedback ? (
                    <p className="text-center text-lg text-primary-cyan">{feedback}</p>
                ) : (
                    <>
                        <div>
                            <label className="block text-primary-cyan font-display text-lg mb-2">Reason for reporting</label>
                            <select 
                                value={reason} 
                                onChange={(e) => setReason(e.target.value as OpportunityReport['reason'])}
                                required
                                className="w-full bg-gray-900/50 border-2 border-cyan-500/50 rounded-md p-3 text-lg text-white"
                            >
                                <option value="" disabled>Select a reason...</option>
                                <option value="broken_link">The application link is broken or wrong.</option>
                                <option value="application_closed">The company is no longer accepting applications.</option>
                                <option value="scam_fraud">This seems like a scam or fraudulent posting.</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-primary-cyan font-display text-lg mb-2">Additional Comments (Optional)</label>
                            <textarea
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                                className="w-full bg-gray-900/50 border-2 border-cyan-500/50 rounded-md p-3 text-lg text-white h-24"
                                placeholder="Provide more details here..."
                            />
                        </div>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? <Spinner /> : "Submit Report"}
                        </Button>
                    </>
                )}
            </form>
        </Modal>
    );
};