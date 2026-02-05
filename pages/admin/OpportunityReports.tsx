import React, { useState } from 'react';
import type { Opportunity, OpportunityReport, AdminProfile } from '../../types.ts';
import { Card } from '../../components/ui/Card.tsx';
import { Spinner } from '../../components/ui/Spinner.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx'; // Import useSupabase
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Pagination } from '../../components/ui/Pagination.tsx';
import { MarkdownRenderer } from '../../components/ai/MarkdownRenderer.tsx';
import { handleAiInvocationError } from '../../utils/errorHandlers.ts'; // Import centralized error handler
import { runAI } from '../../services/aiClient.ts';

interface OpportunityWithStats extends Opportunity {
    opportunity_reports: OpportunityReport[];
    application_count: number;
    top_departments: { department: string, count: number }[];
}

const PAGE_SIZE = 10;

// API Functions - now accepts supabase client
const fetchOpportunityReports = async (supabase, college: string, page: number): Promise<{data: OpportunityWithStats[], count: number}> => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    // Removed 'count' from applications select to prevent SQL GROUP BY error. 
    // We will calculate count from the length of the returned array.
    const { data: opps, error: oppsError, count } = await supabase
        .from('opportunities')
        .select(`*, applications(students(department)), opportunity_reports(*)`, { count: 'exact' })
        .eq('college', college)
        .eq('status', 'under_review')
        .range(from, to);

    if (oppsError) {
      handleAiInvocationError(oppsError); // Use the centralized error handler
      throw oppsError;
    }

    const processedOpps: OpportunityWithStats[] = (opps as any[]).map((opp) => {
        const applications = opp.applications || [];
        const departmentCounts: Record<string, number> = {};
        applications.forEach((app: any) => {
            const dept = app.students?.department;
            if (dept) { departmentCounts[dept] = (departmentCounts[dept] || 0) + 1; }
        });
        const top_departments = Object.entries(departmentCounts)
            .map(([department, count]) => ({ department, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
        
        const opportunity_reports = opp.opportunity_reports || [];
        
        // Use applications.length since we are fetching the rows now
        return { ...opp, application_count: applications.length, top_departments, opportunity_reports };
    });
    processedOpps.sort((a, b) => b.application_count - a.application_count);
    return { data: processedOpps, count: count || 0 };
};

const generateAIInsights = async (supabase, opportunities: OpportunityWithStats[]) => {
    if (opportunities.length === 0) throw new Error("No data available to generate insights.");
    
    const dataForAI = opportunities.slice(0, 15).map(o => ({ 
        title: o.title, 
        company: o.company, 
        applications: o.application_count, 
        top_departments: o.top_departments.map(d => d.department).join(', ') 
    }));
    
    const data = await runAI({
        task: 'opportunity-report-analysis',
        payload: { opportunities: dataForAI },
        supabase,
    });
    return data.text;
};

const handleReportAction = async (supabase, { oppId, action }: { oppId: string, action: 'mark_safe' | 'archive' }) => {
    const newStatus = action === 'mark_safe' ? 'active' : 'archived';

    const { error: updateError } = await supabase
        .from('opportunities')
        .update({ status: newStatus })
        .eq('id', oppId);

    if (updateError) throw updateError;

    const { error: deleteError } = await supabase
        .from('opportunity_reports')
        .delete()
        .eq('opportunity_id', oppId);

    if (deleteError) {
        console.error("Error deleting reports for opportunity:", deleteError.message);
    }
};

const OpportunityReports: React.FC<{ user: AdminProfile }> = ({ user }) => {
    const supabase = useSupabase();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);

    const { data: opportunityReportsData, isLoading } = useQuery<{ data: OpportunityWithStats[]; count: number }, Error>({
        queryKey: ['opportunityReports', user.college, page],
        queryFn: () => fetchOpportunityReports(supabase, user.college, page),
        placeholderData: (previousData) => previousData,
    });

    const opportunities = opportunityReportsData?.data ?? [];
    const count = opportunityReportsData?.count ?? 0;
    const totalPages = Math.ceil(count / PAGE_SIZE);

    const insightsMutation = useMutation({
        mutationFn: () => generateAIInsights(supabase, opportunities),
        onError: (error) => handleAiInvocationError(error),
    });

    const reportActionMutation = useMutation({
        mutationFn: (vars: { oppId: string, action: 'mark_safe' | 'archive' }) => handleReportAction(supabase, vars),
        onSuccess: () => {
            toast.success("Opportunity action taken successfully!");
            queryClient.invalidateQueries({ queryKey: ['opportunityReports', user.college] });
        },
        onError: (error) => handleAiInvocationError(error),
    });


    const formatReason = (reason: string) => {
        return reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="font-display text-4xl text-primary">Opportunity Reports</h1>
                <Button variant="secondary" onClick={() => insightsMutation.mutate()} disabled={insightsMutation.isPending || isLoading}>
                    {insightsMutation.isPending ? <Spinner /> : 'Generate AI Analysis (Deep Thought)'}
                </Button>
            </div>

            {insightsMutation.isPending && (
                <Card glow="secondary" className="mb-6"><div className="flex justify-center items-center h-32"><Spinner /><p className="ml-4">AI is performing a deep analysis...</p></div></Card>
            )}
            {insightsMutation.data && (
                <Card glow="secondary" className="mb-6">
                    <h2 className="font-display text-2xl text-secondary mb-2">AI Strategic Analysis</h2>
                    <MarkdownRenderer content={insightsMutation.data} />
                </Card>
            )}

            <Card glow="none">
                {isLoading && opportunities.length === 0 ? (
                    <div className="flex justify-center p-8"><Spinner /></div>
                ) : (
                    <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-lg">
                            <thead className="font-display text-secondary border-b-2 border-secondary/50">
                                <tr>
                                    <th className="p-3">Opportunity</th>
                                    <th className="p-3">Reported By</th>
                                    <th className="p-3">Reason</th>
                                    <th className="p-3">Comments</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {opportunities.length === 0 && (
                                    <tr><td colSpan={5} className="text-center p-4 text-text-muted">No opportunities currently under review.</td></tr>
                                )}
                                {opportunities.map(opp => (
                                    <tr key={opp.id} className="border-b border-primary/20 hover:bg-primary/10">
                                        <td className="p-3"><p className="font-bold">{opp.title}</p><p className="text-sm text-text-muted">{opp.company}</p></td>
                                        <td className="p-3">{opp.opportunity_reports?.[0]?.reporter_id || 'N/A'}</td>
                                        <td className="p-3">{opp.opportunity_reports?.[0]?.reason ? formatReason(opp.opportunity_reports[0].reason) : 'N/A'}</td>
                                        <td className="p-3 text-sm text-text-muted">{opp.opportunity_reports?.[0]?.comments || 'No comments'}</td>
                                        <td className="p-3 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="secondary" className="text-sm py-1 px-2" onClick={() => reportActionMutation.mutate({ oppId: opp.id, action: 'mark_safe' })}>Mark Safe</Button>
                                                <Button variant="ghost" className="text-sm py-1 px-2 !border-red-400 !text-red-400 hover:!bg-red-500 hover:!text-white" onClick={() => reportActionMutation.mutate({ oppId: opp.id, action: 'archive' })}>Archive</Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                    </>
                )}
            </Card>
        </div>
    );
};

export default OpportunityReports;