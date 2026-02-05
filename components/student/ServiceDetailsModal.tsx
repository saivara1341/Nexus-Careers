import React from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import type { ServiceRequest } from '../../types.ts';
import toast from 'react-hot-toast';
import { useSupabase } from '../../contexts/SupabaseContext.tsx'; // Import useSupabase
import { useMutation } from '@tanstack/react-query'; // Import useMutation

interface ServiceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    serviceRequest: ServiceRequest;
    requesterId: string; // ID of the current user (the requester)
    updateServiceRequestStatus: (supabase: ReturnType<typeof useSupabase>, requestId: string, newStatus: ServiceRequest['status'], userIdForXp: string) => Promise<void>;
    onLeaveFeedback: (serviceRequest: ServiceRequest) => void;
}

export const ServiceDetailsModal: React.FC<ServiceDetailsModalProps> = ({
    isOpen,
    onClose,
    serviceRequest,
    requesterId,
    updateServiceRequestStatus,
    onLeaveFeedback,
}) => {
    const supabase = useSupabase();
    const service = serviceRequest.service;
    const offerer = serviceRequest.offerer;

    const updateStatusMutation = useMutation({
        mutationFn: async ({ requestId, newStatus }: { requestId: string, newStatus: ServiceRequest['status'] }) => {
            await updateServiceRequestStatus(supabase, requestId, newStatus, requesterId);
        },
        onSuccess: (data, variables) => {
            toast.success(`Service request ${variables.newStatus} successfully!`);
            onClose(); // Close modal on success
        },
        onError: (err) => {
            toast.error(`Failed to update request: ${err.message}`);
        },
    });

    const getStatusColor = (status: ServiceRequest['status']) => {
        switch (status) {
            case 'requested': return 'bg-blue-500/50 text-blue-200';
            case 'accepted': return 'bg-yellow-500/50 text-yellow-200';
            case 'completed': return 'bg-green-500/50 text-green-200';
            case 'cancelled': return 'bg-red-500/50 text-red-200';
        }
    };

    const handleCancelRequest = async () => {
        if (confirm("Are you sure you want to cancel this service request?")) {
            updateStatusMutation.mutate({ requestId: serviceRequest.id, newStatus: 'cancelled' });
        }
    };

    // Show spinner if update is in progress
    if (updateStatusMutation.isPending) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Updating Request">
                <div className="flex justify-center p-8">
                    <Spinner />
                    <p className="ml-2 text-text-muted">Processing your request...</p>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Request for "${service?.item_name}"`}>
            {service ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-display text-xl text-primary">{service.item_name}</h3>
                        <span className={`px-3 py-1 text-sm font-bold rounded-full capitalize ${getStatusColor(serviceRequest.status)}`}>
                            {serviceRequest.status}
                        </span>
                    </div>
                    <p className="text-lg text-text-base">{service.description}</p>
                    <p className="text-text-muted">Requested on: {new Date(serviceRequest.created_at).toLocaleDateString()}</p>
                    {serviceRequest.accepted_at && <p className="text-text-muted">Accepted on: {new Date(serviceRequest.accepted_at).toLocaleDateString()}</p>}
                    {serviceRequest.completed_at && <p className="text-text-muted">Completed on: {new Date(serviceRequest.completed_at).toLocaleDateString()}</p>}

                    <div className="border-t border-primary/20 pt-4 space-y-2">
                        <h3 className="font-display text-xl text-secondary">Service Provider: {offerer?.name}</h3>
                        {/* Fix: Access 'email' from offerer */}
                        <p className="text-text-base">Contact: {offerer?.personal_email || offerer?.email} {offerer?.mobile_number && `| ${offerer.mobile_number}`}</p>
                    </div>

                    <div className="flex gap-2 mt-4">
                        {serviceRequest.status === 'requested' && (
                            <Button variant="ghost" className="flex-grow !border-red-400 !text-red-400 hover:!bg-red-500 hover:!text-white" onClick={handleCancelRequest} disabled={updateStatusMutation.isPending}>
                                Cancel Request
                            </Button>
                        )}
                        {serviceRequest.status === 'completed' && !serviceRequest.feedback && (
                            <Button variant="secondary" className="flex-grow" onClick={() => { onLeaveFeedback(serviceRequest); onClose(); }} disabled={updateStatusMutation.isPending}>
                                Leave Feedback
                            </Button>
                        )}
                        {serviceRequest.status === 'completed' && serviceRequest.feedback && (
                            <Button variant="ghost" className="flex-grow !text-green-400 !border-green-400 hover:!bg-green-500 hover:!text-white" onClick={() => { /* View Feedback logic */ onClose(); }} disabled={updateStatusMutation.isPending}>
                                Feedback Provided ({serviceRequest.feedback.rating}/5)
                            </Button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex justify-center p-8"><Spinner /><p className="ml-2 text-text-muted">Loading service details...</p></div> // Should not happen if data is pre-fetched
            )}
        </Modal>
    );
};