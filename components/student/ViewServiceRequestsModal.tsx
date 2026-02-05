import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import { Card } from '../ui/Card.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { CampusResource, ServiceRequest, ServiceFeedback } from '../../types.ts';
import { ServiceFeedbackViewModal } from './ServiceFeedbackViewModal.tsx';

interface ViewServiceRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
    service: CampusResource; // The service for which requests are being viewed
    offererId: string; // The ID of the current user (the offerer)
    updateServiceRequestStatus: (supabase: ReturnType<typeof useSupabase>, requestId: string, newStatus: ServiceRequest['status'], userIdForXp: string) => Promise<void>;
    onViewFeedback: (feedback: ServiceFeedback) => void;
}

// API to fetch service requests for a specific service offered by the current user
const fetchServiceRequestsForOfferedService = async (supabase, serviceId: string, offererId: string): Promise<ServiceRequest[]> => {
    const { data, error } = await supabase
        .from('service_requests')
        .select(`*, requester:students(id, name, personal_email, mobile_number, email), service:campus_resources(id, item_name), feedback:service_feedback(id, rating, feedback_text)`)
        .eq('service_id', serviceId)
        .eq('offerer_id', offererId) // Ensure only requests for *this* offerer's service
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as ServiceRequest[] || [];
};

export const ViewServiceRequestsModal: React.FC<ViewServiceRequestsModalProps> = ({
    isOpen,
    onClose,
    service,
    offererId,
    updateServiceRequestStatus,
    onViewFeedback,
}) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();

    const { data: serviceRequests = [], isLoading, isError, error } = useQuery<ServiceRequest[], Error>({
        queryKey: ['serviceRequestsForOfferedService', service.id, offererId],
        queryFn: () => fetchServiceRequestsForOfferedService(supabase, service.id, offererId),
        enabled: isOpen,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ requestId, newStatus }: { requestId: string, newStatus: ServiceRequest['status'] }) => {
            // Pass offererId for XP calculation
            await updateServiceRequestStatus(supabase, requestId, newStatus, offererId);
        },
        onSuccess: (data, variables) => {
            toast.success(`Service request ${variables.newStatus} successfully!`);
            queryClient.invalidateQueries({ queryKey: ['serviceRequestsForOfferedService', service.id, offererId] });
            queryClient.invalidateQueries({ queryKey: ['requestedServices'] }); // Invalidate requests in case requester is also watching
            queryClient.invalidateQueries({ queryKey: ['userProfile'] }); // Refresh XP
        },
        onError: (err) => toast.error(`Failed to update status: ${err.message}`),
    });

    const getStatusColor = (status: ServiceRequest['status']) => {
        switch (status) {
            case 'requested': return 'bg-blue-500/50 text-blue-200';
            case 'accepted': return 'bg-yellow-500/50 text-yellow-200';
            case 'completed': return 'bg-green-500/50 text-green-200';
            case 'cancelled': return 'bg-red-500/50 text-red-200';
        }
    };
    
    if (isError) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title={`Requests for "${service.item_name}"`}>
                <p className="text-red-400 text-center">Error loading requests: {error?.message}</p>
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Requests for "${service.item_name}"`}>
            <p className="text-lg text-text-muted mb-4">Manage requests for your "{service.item_name}" service.</p>
            <div className="max-h-96 overflow-y-auto space-y-4">
                {isLoading && (
                    <div className="flex justify-center p-8">
                        <Spinner />
                    </div>
                )}
                {!isLoading && serviceRequests.length === 0 && (
                    <p className="text-center text-lg text-text-muted">No requests yet for this service.</p>
                )}
                {serviceRequests.map(request => (
                    <Card key={request.id} glow="primary" className="border-primary/20">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-2">
                            <div>
                                <h3 className="font-display text-xl text-primary">{request.requester?.name}</h3>
                                <p className="text-sm text-text-muted">Requested on: {new Date(request.created_at).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-3 py-1 text-sm font-bold rounded-full capitalize ${getStatusColor(request.status)}`}>
                                {request.status}
                            </span>
                        </div>
                        <div className="text-text-base mb-3">
                            {/* Fix: Access 'email' from requester */}
                            <p>Contact: {request.requester?.personal_email || request.requester?.email} {request.requester?.mobile_number && `| ${request.requester.mobile_number}`}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                            {request.status === 'requested' && (
                                <>
                                    <Button variant="primary" className="text-sm py-1 px-2" onClick={() => updateStatusMutation.mutate({ requestId: request.id, newStatus: 'accepted' })} disabled={updateStatusMutation.isPending}>
                                        {updateStatusMutation.isPending ? <Spinner/> : 'Accept'}
                                    </Button>
                                    <Button variant="ghost" className="text-sm py-1 px-2 !border-red-400 !text-red-400 hover:!bg-red-500 hover:!text-white" onClick={() => updateStatusMutation.mutate({ requestId: request.id, newStatus: 'cancelled' })} disabled={updateStatusMutation.isPending}>
                                        Cancel
                                    </Button>
                                </>
                            )}
                            {request.status === 'accepted' && (
                                <Button variant="secondary" className="text-sm py-1 px-2" onClick={() => updateStatusMutation.mutate({ requestId: request.id, newStatus: 'completed' })} disabled={updateStatusMutation.isPending}>
                                     {updateStatusMutation.isPending ? <Spinner/> : 'Mark Completed'}
                                </Button>
                            )}
                            {request.status === 'completed' && request.feedback && (
                                <Button variant="ghost" className="text-sm py-1 px-2 !text-green-400 !border-green-400 hover:!bg-green-500 hover:!text-white" onClick={() => onViewFeedback(request.feedback!)}>
                                    View Feedback ({request.feedback.rating}/5)
                                </Button>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
        </Modal>
    );
};