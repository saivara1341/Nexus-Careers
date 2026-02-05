
import React, { useState, useEffect } from 'react';
import type { CampusResource, StudentProfile, ServiceRequest, ServiceFeedback } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pagination } from '../../components/ui/Pagination.tsx';
import { SERVICE_CATEGORIES, SERVICE_RATE_UNITS } from '../../types.ts';
import { ServiceRequestModal } from '../../components/student/ServiceRequestModal.tsx';
import { ViewServiceRequestsModal } from '../../components/student/ViewServiceRequestsModal.tsx';
import { ServiceDetailsModal } from '../../components/student/ServiceDetailsModal.tsx';
import { ServiceFeedbackModal } from '../../components/student/ServiceFeedbackModal.tsx';
import { ServiceFeedbackViewModal } from '../../components/student/ServiceFeedbackViewModal.tsx';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts';
import { runAI } from '../../services/aiClient.ts';

interface ResourceExchangePageProps {
    user: StudentProfile;
}

const PAGE_SIZE = 18;

interface ListFormState {
    item_name: string;
    description: string;
    category: string;
    custom_category_input?: string;
    service_rate?: string;
    service_rate_unit?: string;
    custom_rate_unit_input?: string;
    // Availability
    avail_days: string[];
    avail_start_time: string;
    avail_end_time: string;
}

const fetchResources = async (supabase: any, college: string, page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
        .from('campus_resources')
        .select(`*, lister:students ( id, name, personal_email, mobile_number, email )`)
        .eq('college', college)
        .eq('listing_type', 'service')
        .eq('is_moderated', true)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        handleAiInvocationError(error);
        throw error;
    }
    return { data: data as any[] || [], count: count || 0 };
};

const fetchOfferedServices = async (supabase: any, userId: string, page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
        .from('campus_resources')
        .select(`*, lister:students ( id, name, personal_email, mobile_number, email )`)
        .eq('lister_id', userId)
        .eq('listing_type', 'service')
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        handleAiInvocationError(error);
        throw error;
    }
    return { data: data as any[] || [], count: count || 0 };
};

const fetchRequestedServices = async (supabase: any, userId: string, page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
        .from('service_requests')
        .select(`*, 
            service:campus_resources ( *, lister:students ( id, name, personal_email, mobile_number, email ) ), 
            requester:students!requester_id ( id, name, personal_email, mobile_number, email ), 
            offerer:students!offerer_id ( id, name, personal_email, mobile_number, email ), 
            feedback:service_feedback ( id, rating, feedback_text )`)
        .eq('requester_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        handleAiInvocationError(error);
        throw error;
    }
    return { data: data as ServiceRequest[] || [], count: count || 0 };
};


const addResource = async (supabase: any, { user, imageFile, formData }: { user: StudentProfile, imageFile: File | null, formData: ListFormState }) => {
    // 1. AI Moderation Check
    const moderationResult = await runAI({
        task: 'moderate-service-listing',
        payload: { title: formData.item_name, description: formData.description },
        supabase,
    });

    const { isAppropriate, reason } = moderationResult;

    if (!isAppropriate) {
        throw new Error(`Service listing blocked by AI: ${reason || 'Inappropriate content detected.'}`);
    }

    // 2. Image Upload
    let imageUrl = '';
    if (imageFile) {
        const filePath = `resources/${user.id}/${Date.now()}_${imageFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('student-credentials').upload(filePath, imageFile);
        if (uploadError) {
            handleAiInvocationError(uploadError);
            throw uploadError;
        }
        const { data: urlData } = supabase.storage.from('student-credentials').getPublicUrl(uploadData.path);
        imageUrl = urlData.publicUrl;
    } else {
        imageUrl = 'https://picsum.photos/400/300?grayscale&blur=2';
    }

    const finalCategory = formData.category === 'Other' ? formData.custom_category_input || 'Other' : formData.category;
    const finalRateUnit = formData.service_rate_unit === 'other' ? formData.custom_rate_unit_input || 'other' : formData.service_rate_unit;

    // Construct Availability Object
    const availability = {
        days: formData.avail_days,
        startTime: formData.avail_start_time,
        endTime: formData.avail_end_time
    };

    const basePayload: Partial<CampusResource> = {
        lister_id: user.id,
        college: user.college,
        item_name: formData.item_name,
        description: formData.description,
        category: finalCategory,
        listing_type: 'service',
        image_url: imageUrl,
        service_rate: formData.service_rate ? parseFloat(formData.service_rate) : null,
        service_rate_unit: finalRateUnit,
        is_moderated: true,
        moderation_reason: null,
        availability: availability // New Field
    };

    const { error: insertError } = await supabase.from('campus_resources').insert(basePayload);
    if (insertError) {
        handleAiInvocationError(insertError);
        throw insertError;
    }
};

const updateServiceRequestStatus = async (supabase: any, requestId: string, newStatus: ServiceRequest['status'], userIdForXp: string) => {
    const updatePayload: any = { status: newStatus };
    if (newStatus === 'accepted') updatePayload.accepted_at = new Date().toISOString();
    if (newStatus === 'completed') updatePayload.completed_at = new Date().toISOString();

    const { error } = await supabase.from('service_requests').update(updatePayload).eq('id', requestId);
    if (error) throw error;

    if (newStatus === 'completed') {
        await supabase.rpc('award_xp', { user_id: userIdForXp, xp_amount: 50 });
    }
};

const createServiceRequest = async (supabase: any, serviceId: string, requesterId: string) => {
    const { data: service } = await supabase.from('campus_resources').select('lister_id').eq('id', serviceId).single();
    if (service.lister_id === requesterId) throw new Error("You cannot request your own service.");

    const { data: existing } = await supabase.from('service_requests')
        .select('id')
        .eq('service_id', serviceId)
        .eq('requester_id', requesterId)
        .in('status', ['requested', 'accepted'])
        .single();

    if (existing) throw new Error("You already have an active request for this service.");

    const { error } = await supabase.from('service_requests').insert({
        service_id: serviceId,
        requester_id: requesterId,
        offerer_id: service.lister_id,
        status: 'requested'
    });
    if (error) throw error;
};

const addServiceFeedback = async (supabase: any, serviceRequestId: string, rating: number, feedbackText: string) => {
    const { error } = await supabase.from('service_feedback').insert({
        service_request_id: serviceRequestId,
        rating,
        feedback_text: feedbackText
    });
    if (error) throw error;
};

// Days of the week constant
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ResourceExchangePage: React.FC<ResourceExchangePageProps> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'browse' | 'listings' | 'requests'>('browse');
    const [page, setPage] = useState(1);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addForm, setAddForm] = useState<ListFormState>({
        item_name: '', description: '', category: 'Other',
        service_rate: '', service_rate_unit: 'hour',
        avail_days: [], avail_start_time: '16:00', avail_end_time: '20:00'
    });
    const [imageFile, setImageFile] = useState<File | null>(null);

    const { data: browseData, isLoading: browseLoading } = useQuery({
        queryKey: ['campusResources', user.college, page],
        queryFn: () => fetchResources(supabase, user.college, page),
        enabled: activeTab === 'browse'
    });

    const { data: listingsData, isLoading: listingsLoading } = useQuery({
        queryKey: ['myServices', user.id, page],
        queryFn: () => fetchOfferedServices(supabase, user.id, page),
        enabled: activeTab === 'listings'
    });

    const { data: requestsData, isLoading: requestsLoading } = useQuery({
        queryKey: ['requestedServices', user.id, page],
        queryFn: () => fetchRequestedServices(supabase, user.id, page),
        enabled: activeTab === 'requests'
    });

    const addListingMutation = useMutation({
        mutationFn: () => addResource(supabase, { user, imageFile, formData: addForm }),
        onSuccess: () => {
            // Update: Removed XP award text from toast. Points only on completion.
            toast.success("Service listed successfully!");
            queryClient.invalidateQueries({ queryKey: ['campusResources'] });
            queryClient.invalidateQueries({ queryKey: ['myServices'] });
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
            setIsAddModalOpen(false);
            setAddForm({ item_name: '', description: '', category: 'Other', service_rate: '', service_rate_unit: 'hour', avail_days: [], avail_start_time: '16:00', avail_end_time: '20:00' });
            setImageFile(null);
        },
        onError: (e: any) => handleAiInvocationError(e)
    });

    const requestServiceMutation = useMutation({
        mutationFn: (serviceId: string) => createServiceRequest(supabase, serviceId, user.id),
        onSuccess: () => {
            toast.success("Request sent!");
            setIsRequestModalOpen(false);
        },
        onError: (e: any) => toast.error(e.message)
    });

    const [selectedService, setSelectedService] = useState<CampusResource | null>(null);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

    const [viewRequestsService, setViewRequestsService] = useState<CampusResource | null>(null);
    const [isViewRequestsModalOpen, setIsViewRequestsModalOpen] = useState(false);

    const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
    const [isRequestDetailsModalOpen, setIsRequestDetailsModalOpen] = useState(false);

    const [feedbackRequest, setFeedbackRequest] = useState<ServiceRequest | null>(null);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

    const [viewFeedbackData, setViewFeedbackData] = useState<ServiceFeedback | null>(null);
    const [isViewFeedbackModalOpen, setIsViewFeedbackModalOpen] = useState(false);

    const handleFormChange = (e: any) => setAddForm({ ...addForm, [e.target.name]: e.target.value });

    const toggleDay = (day: string) => {
        setAddForm(prev => {
            const days = prev.avail_days.includes(day)
                ? prev.avail_days.filter(d => d !== day)
                : [...prev.avail_days, day];
            return { ...prev, avail_days: days };
        });
    };

    const getStatusColor = (status: ServiceRequest['status']) => {
        switch (status) {
            case 'requested': return 'bg-blue-500/50 text-blue-200';
            case 'accepted': return 'bg-yellow-500/50 text-yellow-200';
            case 'completed': return 'bg-green-500/50 text-green-200';
            case 'cancelled': return 'bg-red-500/50 text-red-200';
        }
    };

    // Helper to format time (e.g. 16:00 -> 4:00 PM)
    const formatTime = (time: string) => {
        if (!time) return '';
        const [h, m] = time.split(':');
        const hour = parseInt(h);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedHour = hour % 12 || 12;
        return `${formattedHour}:${m} ${ampm}`;
    };


    return (
        <div>
            <header className="mb-8">
                <div className="flex flex-col md:flex-row justify-between md:items-start gap-6">
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl font-bold uppercase mb-2 text-primary">
                            Nexus Gigs
                        </h1>
                        <p className="text-text-muted text-sm font-mono max-w-2xl italic">
                            Peer-to-peer campus service economy. Exchange skills, tutoring, and technical support.
                        </p>
                    </div>
                    <div className="flex gap-2 bg-card-bg/50 p-1 rounded-lg border border-primary/20 shrink-0">
                        <button onClick={() => { setActiveTab('browse'); setPage(1); }} className={`px-4 py-2 rounded-md text-[10px] md:text-xs font-display uppercase tracking-wider font-bold transition-all ${activeTab === 'browse' ? 'bg-primary text-black shadow-md' : 'text-text-muted hover:text-white'}`}>Browse</button>
                        <button onClick={() => { setActiveTab('listings'); setPage(1); }} className={`px-4 py-2 rounded-md text-[10px] md:text-xs font-display uppercase tracking-wider font-bold transition-all ${activeTab === 'listings' ? 'bg-secondary text-black shadow-md' : 'text-text-muted hover:text-white'}`}>My Listings</button>
                        <button onClick={() => { setActiveTab('requests'); setPage(1); }} className={`px-4 py-2 rounded-md text-[10px] md:text-xs font-display uppercase tracking-wider font-bold transition-all ${activeTab === 'requests' ? 'bg-primary text-black shadow-md' : 'text-text-muted hover:text-white'}`}>My Requests</button>
                    </div>
                </div>
            </header>

            {activeTab === 'browse' && (
                <>
                    <div className="mb-4 flex justify-end">
                        <Button variant="secondary" onClick={() => setIsAddModalOpen(true)}>+ Offer Service</Button>
                    </div>
                    {browseLoading ? <div className="flex justify-center p-8"><Spinner /></div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {browseData?.data.map((item: any) => (
                                <Card key={item.id} glow="secondary" className="flex flex-col h-full">
                                    <div className="h-40 w-full bg-cover bg-center rounded-md mb-4" style={{ backgroundImage: `url(${item.image_url})` }}></div>
                                    <h3 className="font-display text-xl text-primary mb-1">{item.item_name}</h3>
                                    <p className="text-sm text-text-muted mb-2">by {item.lister?.name}</p>

                                    {/* Availability Badge */}
                                    {item.availability && item.availability.days && item.availability.days.length > 0 && (
                                        <div className="mb-3 flex items-center gap-2 bg-black/30 p-2 rounded text-xs border border-white/5">
                                            <span className="text-xl">🕒</span>
                                            <div>
                                                <p className="font-bold text-secondary">{item.availability.days.join(', ')}</p>
                                                <p className="text-text-muted">{formatTime(item.availability.startTime)} - {formatTime(item.availability.endTime)}</p>
                                            </div>
                                        </div>
                                    )}

                                    <p className="text-text-base mb-4 flex-grow line-clamp-3">{item.description}</p>
                                    <div className="flex justify-between items-center mt-auto pt-4 border-t border-primary/20">
                                        <span className="font-bold text-secondary">{item.service_rate ? `₹${item.service_rate}/${item.service_rate_unit}` : 'Contact for Rate'}</span>
                                        {item.lister_id !== user.id && (
                                            <Button variant="ghost" className="text-xs" onClick={() => { setSelectedService(item); setIsRequestModalOpen(true); }}>Request</Button>
                                        )}
                                    </div>
                                </Card>
                            ))}
                            {browseData?.data.length === 0 && <p className="col-span-full text-center text-text-muted">No services listed yet.</p>}
                        </div>
                    )}
                    <Pagination currentPage={page} totalPages={Math.ceil((browseData?.count || 0) / PAGE_SIZE)} onPageChange={setPage} />
                </>
            )}

            {activeTab === 'listings' && (
                <>
                    <div className="mb-4 flex justify-end"><Button variant="secondary" onClick={() => setIsAddModalOpen(true)}>+ Add New</Button></div>
                    {listingsLoading ? <div className="flex justify-center p-8"><Spinner /></div> : (
                        <div className="space-y-4">
                            {listingsData?.data.map((item: any) => (
                                <Card key={item.id} glow="none" className="flex flex-col md:flex-row justify-between items-center">
                                    <div className="flex items-center gap-4 flex-grow">
                                        <img src={item.image_url} alt={item.item_name} className="w-24 h-24 object-cover rounded" />
                                        <div>
                                            <h3 className="font-display text-xl text-primary">{item.item_name}</h3>
                                            <p className="text-sm text-secondary">{item.service_rate ? `₹${item.service_rate}/${item.service_rate_unit}` : 'Custom Rate'}</p>
                                            {item.availability && (
                                                <p className="text-xs text-text-muted mt-1">Available: {item.availability.days?.join(', ')} • {formatTime(item.availability.startTime)} - {formatTime(item.availability.endTime)}</p>
                                            )}
                                            <p className={`text-xs mt-1 font-bold ${item.is_moderated ? 'text-green-400' : 'text-yellow-400'}`}>{item.is_moderated ? 'Approved' : 'Pending Approval'}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" className="mt-4 md:mt-0" onClick={() => { setViewRequestsService(item); setIsViewRequestsModalOpen(true); }}>View Requests</Button>
                                </Card>
                            ))}
                            {listingsData?.data.length === 0 && <p className="text-center text-text-muted">You haven't listed any services.</p>}
                        </div>
                    )}
                    <Pagination currentPage={page} totalPages={Math.ceil((listingsData?.count || 0) / PAGE_SIZE)} onPageChange={setPage} />
                </>
            )}

            {activeTab === 'requests' && (
                <>
                    {requestsLoading ? <div className="flex justify-center p-8"><Spinner /></div> : (
                        <div className="space-y-4">
                            {requestsData?.data.map((req: any) => (
                                <Card key={req.id} glow="none" className="flex flex-col md:flex-row justify-between items-center cursor-pointer" onClick={() => { setSelectedRequest(req); setIsRequestDetailsModalOpen(true); }}>
                                    <div>
                                        <h3 className="font-display text-xl text-primary">{req.service?.item_name}</h3>
                                        <p className="text-sm text-text-muted">Requested from: {req.offerer?.name}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 text-sm font-bold rounded-full capitalize ${getStatusColor(req.status)}`}>
                                            {req.status}
                                        </span>
                                    </div>
                                </Card>
                            ))}
                            {requestsData?.data.length === 0 && <p className="text-center text-text-muted">You haven't requested any services.</p>}
                        </div>
                    )}
                    <Pagination currentPage={page} totalPages={Math.ceil((requestsData?.count || 0) / PAGE_SIZE)} onPageChange={setPage} />
                </>
            )}

            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Offer a New Service">
                <form onSubmit={(e) => { e.preventDefault(); addListingMutation.mutate(); }} className="space-y-4">
                    <Input label="Service Name" name="item_name" value={addForm.item_name} onChange={handleFormChange} required placeholder="e.g., Python Tutoring" />
                    <textarea name="description" value={addForm.description} onChange={handleFormChange} required placeholder="Describe the service you are offering..." className="w-full h-24 bg-input-bg border-2 border-primary/50 rounded-md p-3 text-lg text-text-base" />
                    <Input label="Upload Image (Optional)" type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                    <div>
                        <label className="block text-primary font-student-label text-lg mb-2">Category</label>
                        <select name="category" value={addForm.category} onChange={handleFormChange} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-lg text-text-base">
                            {SERVICE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        {addForm.category === 'Other' && (
                            <Input name="custom_category_input" value={addForm.custom_category_input || ''} onChange={handleFormChange} placeholder="Enter custom category" className="mt-2" />
                        )}
                    </div>

                    {/* Availability Section */}
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/20">
                        <label className="block text-primary font-student-label text-lg mb-3">Your Availability (Due to Classes)</label>
                        <div className="flex gap-2 flex-wrap mb-4 justify-center">
                            {DAYS_OF_WEEK.map(day => (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => toggleDay(day)}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${addForm.avail_days.includes(day) ? 'bg-secondary text-black shadow-[0_0_10px_orange]' : 'bg-input-bg text-text-muted hover:text-white'}`}
                                >
                                    {day.charAt(0)}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-4 items-center">
                            <div className="flex-1">
                                <label className="text-xs text-text-muted mb-1 block">From</label>
                                <Input type="time" name="avail_start_time" value={addForm.avail_start_time} onChange={handleFormChange} />
                            </div>
                            <span className="text-text-muted mt-4">to</span>
                            <div className="flex-1">
                                <label className="text-xs text-text-muted mb-1 block">To</label>
                                <Input type="time" name="avail_end_time" value={addForm.avail_end_time} onChange={handleFormChange} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Rate (₹)" name="service_rate" type="number" step="10" placeholder="e.g., 500" value={addForm.service_rate} onChange={handleFormChange} />
                        <div>
                            <label className="block text-primary font-student-label text-lg mb-2">Per</label>
                            <select name="service_rate_unit" value={addForm.service_rate_unit} onChange={handleFormChange} className="w-full bg-input-bg border-2 border-primary/50 rounded-md p-3 text-lg text-text-base">
                                {SERVICE_RATE_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                            </select>
                            {addForm.service_rate_unit === 'other' && (
                                <Input name="custom_rate_unit_input" value={addForm.custom_rate_unit_input || ''} onChange={handleFormChange} placeholder="Enter custom unit" className="mt-2" />
                            )}
                        </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={addListingMutation.isPending}>
                        {addListingMutation.isPending ? <Spinner /> : "List Service"}
                    </Button>
                </form>
            </Modal>

            {selectedService && (
                <ServiceRequestModal
                    isOpen={isRequestModalOpen}
                    onClose={() => setIsRequestModalOpen(false)}
                    service={selectedService}
                    requester={user}
                    onRequestService={requestServiceMutation.mutate}
                    isLoading={requestServiceMutation.isPending}
                />
            )}

            {viewRequestsService && (
                <ViewServiceRequestsModal
                    isOpen={isViewRequestsModalOpen}
                    onClose={() => setIsViewRequestsModalOpen(false)}
                    service={viewRequestsService}
                    offererId={user.id}
                    updateServiceRequestStatus={updateServiceRequestStatus}
                    onViewFeedback={(feedback) => { setViewFeedbackData(feedback); setIsViewFeedbackModalOpen(true); }}
                />
            )}

            {selectedRequest && (
                <ServiceDetailsModal
                    isOpen={isRequestDetailsModalOpen}
                    onClose={() => setIsRequestDetailsModalOpen(false)}
                    serviceRequest={selectedRequest}
                    requesterId={user.id}
                    updateServiceRequestStatus={updateServiceRequestStatus}
                    onLeaveFeedback={(req) => { setFeedbackRequest(req); setIsFeedbackModalOpen(true); }}
                />
            )}

            {feedbackRequest && (
                <ServiceFeedbackModal
                    isOpen={isFeedbackModalOpen}
                    onClose={() => setIsFeedbackModalOpen(false)}
                    serviceRequest={feedbackRequest}
                    raterId={user.id}
                    ratedUserId={feedbackRequest.offerer_id}
                    addServiceFeedback={addServiceFeedback}
                    onFeedbackProvided={() => {
                        queryClient.invalidateQueries({ queryKey: ['requestedServices', user.id] });
                        setIsFeedbackModalOpen(false);
                    }}
                />
            )}

            {viewFeedbackData && (
                <ServiceFeedbackViewModal
                    isOpen={isViewFeedbackModalOpen}
                    onClose={() => setIsViewFeedbackModalOpen(false)}
                    feedback={viewFeedbackData}
                />
            )}

        </div>
    );
};

export default ResourceExchangePage;
