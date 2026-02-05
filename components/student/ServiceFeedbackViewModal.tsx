import React from 'react';
import { Modal } from '../ui/Modal.tsx';
import type { ServiceFeedback } from '../../types.ts';

interface ServiceFeedbackViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    feedback: ServiceFeedback;
}

export const ServiceFeedbackViewModal: React.FC<ServiceFeedbackViewModalProps> = ({
    isOpen,
    onClose,
    feedback,
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Customer Feedback">
            <div className="space-y-4">
                <p className="text-lg text-text-muted">Here is the feedback you received for a completed service.</p>
                
                <div>
                    <h3 className="font-display text-xl text-primary">Rating:</h3>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <span
                                key={star}
                                className={`text-3xl ${star <= feedback.rating ? 'text-yellow-400' : 'text-gray-500'}`}
                            >
                                ★
                            </span>
                        ))}
                    </div>
                </div>

                <div>
                    <h3 className="font-display text-xl text-primary">Comments:</h3>
                    <p className="bg-input-bg rounded-md p-3 text-lg text-text-base whitespace-pre-wrap">
                        {feedback.feedback_text}
                    </p>
                </div>

                <p className="text-sm text-text-muted">Received on: {new Date(feedback.created_at).toLocaleDateString()}</p>
            </div>
        </Modal>
    );
};