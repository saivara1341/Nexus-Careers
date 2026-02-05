import React, { useState } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { ServiceRequest } from '../../types.ts';
import { useSupabase } from '../../contexts/SupabaseContext.tsx'; // Import useSupabase

interface ServiceFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    serviceRequest: ServiceRequest;
    raterId: string; // The ID of the student giving feedback (requester)
    ratedUserId: string; // The ID of the student receiving feedback (offerer)
    addServiceFeedback: (supabase: ReturnType<typeof useSupabase>, serviceRequestId: string, rating: number, feedbackText: string) => Promise<void>; // Corrected prop type
    onFeedbackProvided: () => void; // Callback after successful feedback
}

export const ServiceFeedbackModal: React.FC<ServiceFeedbackModalProps> = ({
    isOpen,
    onClose,
    serviceRequest,
    raterId,
    ratedUserId,
    addServiceFeedback, // Corrected prop name
    onFeedbackProvided,
}) => {
    const supabase = useSupabase(); // Use the Supabase client from context
    const [rating, setRating] = useState(5); // Default to 5 stars
    const [feedbackText, setFeedbackText] = useState('');

    const submitFeedbackMutation = useMutation({
        mutationFn: async ({ ratingValue, feedbackContent }: { ratingValue: number, feedbackContent: string }) => {
            // Call the raw API function with the locally obtained supabase instance
            await addServiceFeedback(supabase, serviceRequest.id, ratingValue, feedbackContent);
        },
        onSuccess: () => {
            toast.success("Feedback submitted successfully! Thank you.");
            onFeedbackProvided(); // Notify parent component
        },
        onError: (err) => toast.error(`Failed to submit feedback: ${err.message}`),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedbackText.trim()) {
            toast.error("Please provide some feedback text.");
            return;
        }
        submitFeedbackMutation.mutate({ ratingValue: rating, feedbackContent: feedbackText });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Feedback for ${serviceRequest.service?.item_name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-lg text-text-muted">How was your experience with {serviceRequest.offerer?.name} for "{serviceRequest.service?.item_name}"?</p>
                
                <div>
                    <label className="block text-primary font-display text-lg mb-2">Rating</label>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                className={`text-3xl ${star <= rating ? 'text-yellow-400' : 'text-gray-500'} hover:text-yellow-300 transition-colors`}
                                aria-label={`${star} star rating`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-primary font-display text-lg mb-2">Feedback Comments</label>
                    <textarea 
                        value={feedbackText} 
                        onChange={e => setFeedbackText(e.target.value)}
                        placeholder="Share your experience (e.g., punctuality, quality, communication)..."
                        rows={4}
                        className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-lg text-text-base h-24"
                        required
                    />
                </div>

                <Button type="submit" className="w-full mt-6" disabled={submitFeedbackMutation.isPending}>
                    {submitFeedbackMutation.isPending ? <Spinner /> : 'Submit Feedback'}
                </Button>
            </form>
        </Modal>
    );
};