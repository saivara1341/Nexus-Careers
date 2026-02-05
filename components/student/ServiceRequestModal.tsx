import React, { useState } from 'react';
import { Modal } from '../ui/Modal.tsx';
import { Button } from '../ui/Button.tsx';
import { Input } from '../ui/Input.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import type { CampusResource, StudentProfile } from '../../types.ts';
import toast from 'react-hot-toast';

interface ServiceRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    service: CampusResource;
    requester: StudentProfile; // The student making the request
    onRequestService: (serviceId: string) => void; // Function to initiate the request
    isLoading: boolean;
}

export const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({
    isOpen,
    onClose,
    service,
    requester,
    onRequestService,
    isLoading,
}) => {
    const [contactEmail, setContactEmail] = useState(requester.personal_email || requester.email);
    const [contactMobile, setContactMobile] = useState(requester.mobile_number || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!contactEmail.trim() && !contactMobile.trim()) {
            toast.error("Please provide at least one contact method (email or mobile).");
            return;
        }
        onRequestService(service.id);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Request: ${service.item_name}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-lg text-text-muted">You are requesting "{service.item_name}" from {service.lister?.name}. Please confirm your contact details so the service provider can reach you.</p>
                
                <div className="space-y-2">
                    <h3 className="font-display text-xl text-primary">Your Contact Details</h3>
                    <Input 
                        label="Contact Email" 
                        type="email" 
                        value={contactEmail} 
                        onChange={e => setContactEmail(e.target.value)} 
                        placeholder="Your personal email"
                        required={!contactMobile.trim()} // Required if mobile is empty
                    />
                    <Input 
                        label="Contact Mobile" 
                        type="tel" 
                        value={contactMobile} 
                        onChange={e => setContactMobile(e.target.value)} 
                        placeholder="Your mobile number"
                        required={!contactEmail.trim()} // Required if email is empty
                    />
                     <p className="text-sm text-text-muted">Note: Your provided contact details will be shared with {service.lister?.name} once the request is sent.</p>
                </div>

                <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                    {isLoading ? <Spinner /> : `Confirm Request for ${service.service_rate ? `₹${service.service_rate} / ${service.service_rate_unit}` : 'Rate Varies'}`}
                </Button>
            </form>
        </Modal>
    );
};