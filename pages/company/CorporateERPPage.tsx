import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../contexts/SupabaseContext.tsx';
import type { Application, CompanyProfile, Opportunity } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { downloadCsv } from '../../utils/csv.ts';
import { generateGoogleMeetLink } from '../../utils/meet.ts';
import toast from 'react-hot-toast';

type ErpTab = 'drives' | 'interviews' | 'assessments' | 'onboarding';
type CompanyApplication = Application & { opportunity?: Opportunity };

const fetchCorporateErp = async (supabase: any, companyName: string) => {
    const { data: opportunities, error: opportunityError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('company', companyName)
        .order('created_at', { ascending: false });
    if (opportunityError) throw opportunityError;

    const opportunityIds = (opportunities || []).map((opportunity: Opportunity) => opportunity.id);
    if (!opportunityIds.length) return { opportunities: [] as Opportunity[], applications: [] as CompanyApplication[] };

    const { data: applications, error: applicationError } = await supabase
        .from('applications')
        .select('*, student:students(*), opportunity:opportunities(*)')
        .in('opportunity_id', opportunityIds)
        .order('created_at', { ascending: false });
    if (applicationError) throw applicationError;

    return {
        opportunities: (opportunities || []) as Opportunity[],
        applications: (applications || []) as CompanyApplication[]
    };
};

const updateApplication = async (supabase: any, applicationId: string, payload: Partial<Application>, actorId?: string) => {
    const { error } = await supabase.from('applications').update({
        ...payload,
        last_action_by: actorId,
        updated_at: new Date().toISOString()
    }).eq('id', applicationId);
    if (error) throw error;
};

const CorporateERPPage: React.FC<{ user: CompanyProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<ErpTab>('drives');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJobId, setSelectedJobId] = useState('all');
    const [editingApplication, setEditingApplication] = useState<CompanyApplication | null>(null);
    const [interviewAt, setInterviewAt] = useState('');
    const [interviewLink, setInterviewLink] = useState('');
    const [assessmentTitle, setAssessmentTitle] = useState('Technical Assessment');
    const [assessmentDueAt, setAssessmentDueAt] = useState('');
    const [scoreDraft, setScoreDraft] = useState('');
    const [notesDraft, setNotesDraft] = useState('');
    const [joiningDate, setJoiningDate] = useState('');
    const [workLocation, setWorkLocation] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['corporateErp', user.company_name],
        queryFn: () => fetchCorporateErp(supabase, user.company_name)
    });

    const opportunities = data?.opportunities || [];
    const applications = data?.applications || [];

    const filteredApplications = useMemo(() => {
        const normalized = searchTerm.trim().toLowerCase();
        return applications.filter(app => {
            if (selectedJobId !== 'all' && app.opportunity_id !== selectedJobId) return false;
            if (!normalized) return true;
            return [
                app.student?.name,
                app.student?.roll_number,
                app.student?.email,
                app.student?.department,
                app.opportunity?.title,
                app.current_stage,
                app.status
            ].join(' ').toLowerCase().includes(normalized);
        });
    }, [applications, searchTerm, selectedJobId]);

    const driveStats = useMemo(() => {
        const total = applications.length;
        const assessments = applications.filter(app => app.current_stage === 'Assessment' || app.metadata?.assessment_title).length;
        const interviews = applications.filter(app => app.current_stage === 'Interview' || app.interview_at).length;
        const offers = applications.filter(app => app.status === 'offered' || app.status === 'hired').length;
        const hired = applications.filter(app => app.status === 'hired').length;
        return {
            drives: opportunities.length,
            activeDrives: opportunities.filter(job => job.status === 'active').length,
            total,
            assessments,
            interviews,
            offers,
            hired,
            conversion: total ? Math.round((offers / total) * 100) : 0
        };
    }, [applications, opportunities]);

    const updateMutation = useMutation({
        mutationFn: ({ appId, payload }: { appId: string; payload: Partial<Application> }) => updateApplication(supabase, appId, payload, user.id),
        onSuccess: () => {
            toast.success('ERP record updated.');
            queryClient.invalidateQueries({ queryKey: ['corporateErp', user.company_name] });
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
            setEditingApplication(null);
        },
        onError: (error: any) => toast.error(error.message || 'Update failed.')
    });

    const openManageModal = (app: CompanyApplication) => {
        setEditingApplication(app);
        setInterviewAt(app.interview_at ? new Date(app.interview_at).toISOString().slice(0, 16) : '');
        setInterviewLink(app.interview_link || '');
        setAssessmentTitle(app.metadata?.assessment_title || 'Technical Assessment');
        setAssessmentDueAt(app.metadata?.assessment_due_at ? new Date(app.metadata.assessment_due_at).toISOString().slice(0, 16) : '');
        setScoreDraft(app.metadata?.assessment_score?.toString() || '');
        setNotesDraft(app.candidate_notes || '');
        setJoiningDate(app.metadata?.joining_date || '');
        setWorkLocation(app.offer_location || app.metadata?.work_location || '');
    };

    const saveManagedRecord = (targetStatus?: Application['status'], targetStage?: string) => {
        if (!editingApplication) return;
        const metadata = {
            ...(editingApplication.metadata || {}),
            assessment_title: assessmentTitle || null,
            assessment_due_at: assessmentDueAt ? new Date(assessmentDueAt).toISOString() : null,
            assessment_score: scoreDraft ? Number(scoreDraft) : null,
            joining_date: joiningDate || null,
            work_location: workLocation || null,
            onboarding_updated_at: new Date().toISOString()
        };
        updateMutation.mutate({
            appId: editingApplication.id,
            payload: {
                candidate_notes: notesDraft,
                interview_at: interviewAt ? new Date(interviewAt).toISOString() : null,
                interview_link: interviewLink || null,
                offer_location: workLocation || editingApplication.offer_location || null,
                current_stage: targetStage || editingApplication.current_stage || 'Applied',
                status: targetStatus || editingApplication.status,
                metadata
            }
        });
    };

    const exportApplications = (scope: ErpTab = activeTab) => {
        const scopedRows = getScopedRows(scope);
        if (!scopedRows.length) return toast.error('No records to export.');
        downloadCsv(scopedRows.map(app => ({
            Drive: app.opportunity?.title || '',
            Candidate: app.student?.name || '',
            Roll_Number: app.student?.roll_number || '',
            Email: app.student?.email || '',
            Mobile: app.student?.mobile_number || '',
            Department: app.student?.department || '',
            CGPA: app.student?.ug_cgpa || '',
            Backlogs: app.student?.backlogs ?? '',
            Stage: app.current_stage || 'Applied',
            Status: app.status,
            Interview_At: app.interview_at || '',
            Interview_Link: app.interview_link || '',
            Assessment: app.metadata?.assessment_title || '',
            Assessment_Due: app.metadata?.assessment_due_at || '',
            Assessment_Score: app.metadata?.assessment_score ?? '',
            Offer_Package_LPA: app.offer_package_lpa || '',
            Offer_Designation: app.offer_designation || '',
            Joining_Date: app.metadata?.joining_date || '',
            Work_Location: app.offer_location || app.metadata?.work_location || '',
            Notes: app.candidate_notes || ''
        })), `${user.company_name.replace(/[^a-z0-9]/gi, '_')}_${scope}_erp_export.csv`);
    };

    const getScopedRows = (scope: ErpTab) => {
        if (scope === 'interviews') return filteredApplications.filter(app => app.current_stage === 'Interview' || app.interview_at);
        if (scope === 'assessments') return filteredApplications.filter(app => app.current_stage === 'Assessment' || app.metadata?.assessment_title);
        if (scope === 'onboarding') return filteredApplications.filter(app => app.status === 'offered' || app.status === 'hired');
        return filteredApplications;
    };

    const scopedApplications = getScopedRows(activeTab);

    if (isLoading) return <div className="flex justify-center p-12"><Spinner /></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-text-muted font-bold mb-2">Corporate ERP</p>
                    <h1 className="font-display text-2xl md:text-3xl text-primary">Placement Operations Command</h1>
                    <p className="text-sm text-text-muted mt-1">Control drives, interviews, assessments, onboarding, and exports from one workspace.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => exportApplications('drives')} className="text-sm border-white/10">Export All</Button>
                    <Button variant="secondary" onClick={() => exportApplications(activeTab)} className="text-sm">Export Current View</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-8 gap-3">
                <ErpMetric label="Drives" value={driveStats.drives} />
                <ErpMetric label="Active" value={driveStats.activeDrives} />
                <ErpMetric label="Candidates" value={driveStats.total} />
                <ErpMetric label="Assessments" value={driveStats.assessments} />
                <ErpMetric label="Interviews" value={driveStats.interviews} />
                <ErpMetric label="Offers" value={driveStats.offers} tone="text-green-400" />
                <ErpMetric label="Hired" value={driveStats.hired} tone="text-secondary" />
                <ErpMetric label="Conv %" value={driveStats.conversion} tone="text-yellow-300" />
            </div>

            <Card glow="none" className="border-white/10 bg-card-bg/40">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
                    <Input label="Search ERP Records" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Candidate, roll number, drive, stage" />
                    <div>
                        <label className="block text-primary font-display text-sm font-bold uppercase mb-2">Drive</label>
                        <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className="w-full lg:w-72 bg-input-bg border-2 border-primary/50 rounded-md p-3 text-base text-text-base focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="all">All Drives</option>
                            {opportunities.map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
                        </select>
                    </div>
                    <div className="bg-black/20 border border-white/10 rounded-lg p-3 text-xs text-text-muted">
                        Visible Records
                        <span className="block text-2xl text-primary font-bold">{scopedApplications.length}</span>
                    </div>
                </div>
            </Card>

            <div className="flex flex-wrap gap-2">
                {([
                    ['drives', 'Drive Glance'],
                    ['interviews', 'Interviews'],
                    ['assessments', 'Mock Tests & Assessments'],
                    ['onboarding', 'Offer & Onboarding']
                ] as [ErpTab, string][]).map(([tab, label]) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === tab ? 'bg-primary text-black' : 'bg-card-bg border border-white/10 text-text-muted hover:text-white'}`}>
                        {label}
                    </button>
                ))}
            </div>

            <Card glow="none" className="border-white/10 !p-0 overflow-hidden">
                <div className="overflow-auto custom-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-text-muted uppercase text-[10px] tracking-widest sticky top-0">
                            <tr>
                                <th className="p-3">Candidate</th>
                                <th className="p-3">Drive</th>
                                <th className="p-3">Stage</th>
                                <th className="p-3">Interview</th>
                                <th className="p-3">Assessment</th>
                                <th className="p-3">Offer/Join</th>
                                <th className="p-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {scopedApplications.map(app => (
                                <tr key={app.id} className="hover:bg-white/5">
                                    <td className="p-3">
                                        <p className="font-bold text-white">{app.student?.name || 'Candidate'}</p>
                                        <p className="text-xs text-text-muted">{app.student?.roll_number} • {app.student?.department}</p>
                                    </td>
                                    <td className="p-3">
                                        <p className="font-bold text-primary">{app.opportunity?.title || 'Drive'}</p>
                                        <p className="text-xs text-text-muted">{app.opportunity?.college}</p>
                                    </td>
                                    <td className="p-3">
                                        <span className="px-2 py-1 rounded bg-white/10 text-xs">{app.current_stage || 'Applied'}</span>
                                        <p className="text-[10px] text-text-muted uppercase mt-1">{app.status}</p>
                                    </td>
                                    <td className="p-3 text-xs">
                                        {app.interview_at ? new Date(app.interview_at).toLocaleString() : <span className="text-text-muted">Not scheduled</span>}
                                        {app.interview_link && <a href={app.interview_link} target="_blank" rel="noreferrer" className="block text-secondary hover:underline">Meeting Link</a>}
                                    </td>
                                    <td className="p-3 text-xs">
                                        <p>{app.metadata?.assessment_title || 'Not assigned'}</p>
                                        <p className="text-text-muted">{app.metadata?.assessment_score !== undefined && app.metadata?.assessment_score !== null ? `Score: ${app.metadata.assessment_score}` : app.metadata?.assessment_due_at ? `Due: ${new Date(app.metadata.assessment_due_at).toLocaleString()}` : ''}</p>
                                    </td>
                                    <td className="p-3 text-xs">
                                        <p>{app.offer_designation || (app.status === 'offered' ? 'Offer issued' : 'Pending')}</p>
                                        <p className="text-text-muted">{app.metadata?.joining_date || app.offer_location || ''}</p>
                                    </td>
                                    <td className="p-3 text-right">
                                        <Button variant="ghost" className="text-[10px] px-2 py-1" onClick={() => openManageModal(app)}>Manage</Button>
                                    </td>
                                </tr>
                            ))}
                            {scopedApplications.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-text-muted">No ERP records match this view.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {editingApplication && (
                <Modal isOpen={!!editingApplication} onClose={() => setEditingApplication(null)} title={`ERP Record: ${editingApplication.student?.name || 'Candidate'}`}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="bg-black/20 border border-white/10 rounded p-3">
                                <p className="text-text-muted uppercase font-bold">Drive</p>
                                <p className="text-primary font-bold">{editingApplication.opportunity?.title}</p>
                            </div>
                            <div className="bg-black/20 border border-white/10 rounded p-3">
                                <p className="text-text-muted uppercase font-bold">Status</p>
                                <p className="text-secondary font-bold">{editingApplication.status}</p>
                            </div>
                        </div>

                        <label className="block">
                            <span className="block text-primary font-display text-sm font-bold uppercase mb-2">Recruiter Notes</span>
                            <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} className="w-full min-h-24 bg-input-bg border-2 border-primary/50 rounded-md p-3 text-sm text-text-base focus:outline-none focus:ring-2 focus:ring-primary" />
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                            <Input label="Interview Time" type="datetime-local" value={interviewAt} onChange={e => setInterviewAt(e.target.value)} />
                            <Button variant="ghost" onClick={() => setInterviewLink(generateGoogleMeetLink())}>Generate Meet</Button>
                        </div>
                        <Input label="Interview Link" value={interviewLink} onChange={e => setInterviewLink(e.target.value)} placeholder="https://meet.google.com/..." />

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input label="Assessment / Mock Test" value={assessmentTitle} onChange={e => setAssessmentTitle(e.target.value)} />
                            <Input label="Assessment Due" type="datetime-local" value={assessmentDueAt} onChange={e => setAssessmentDueAt(e.target.value)} />
                            <Input label="Score" type="number" value={scoreDraft} onChange={e => setScoreDraft(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label="Joining Date" type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} />
                            <Input label="Work Location" value={workLocation} onChange={e => setWorkLocation(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Button variant="secondary" onClick={() => saveManagedRecord('shortlisted', 'Assessment')}>Assign Test</Button>
                            <Button variant="secondary" onClick={() => saveManagedRecord('shortlisted', 'Interview')}>Schedule Interview</Button>
                            <Button variant="primary" onClick={() => saveManagedRecord('offered', 'Offer')}>Announce Offer</Button>
                            <Button variant="primary" onClick={() => saveManagedRecord('hired', 'Onboarding')}>Mark Hired</Button>
                        </div>
                        <Button className="w-full" onClick={() => saveManagedRecord()} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? <Spinner /> : 'Save ERP Record'}
                        </Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const ErpMetric: React.FC<{ label: string; value: number; tone?: string }> = ({ label, value, tone = 'text-primary' }) => (
    <Card className="text-center py-4 px-2">
        <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">{label}</p>
        <p className={`font-mono text-2xl font-bold ${tone}`}>{value}</p>
    </Card>
);

export default CorporateERPPage;
