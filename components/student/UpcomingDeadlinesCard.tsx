
import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card.tsx';
import { Spinner } from '../ui/Spinner.tsx';
import { useSupabase } from '../../contexts/SupabaseContext.tsx'; // Import useSupabase
import type { Opportunity, StudentProfile } from '../../types.ts';
import { normalizeDepartmentName } from '../../types.ts'; // Import normalizeDepartmentName
import { handleAiInvocationError } from '../../utils/errorHandlers.ts'; // Import centralized error handler

interface UpcomingDeadlinesCardProps {
    user: StudentProfile;
}

export const UpcomingDeadlinesCard: React.FC<UpcomingDeadlinesCardProps> = ({ user }) => {
    const supabase = useSupabase(); // Use the Supabase client from context
    const [deadlines, setDeadlines] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDeadlines = async () => {
            setLoading(true);
            try {
                 const today = new Date().toISOString();
                // Normalize user's department name for consistent comparison.
                // Keep the DB query broad and apply the array OR locally; PostgREST
                // array syntax is brittle across generated client types.
                const normalizedUserDepartment = normalizeDepartmentName(user.department);

                let { data, error } = await supabase
                    .from('opportunities')
                    .select('id, title, company, deadline, allowed_departments')
                    .eq('college', user.college)
                    .eq('status', 'active')
                    .gte('deadline', today)
                    .lte('min_cgpa', user.ug_cgpa)
                    .order('deadline', { ascending: true })
                    .limit(25);

                if (error?.message?.includes('deadline')) {
                    const fallback = await supabase
                        .from('opportunities')
                        .select('id, title, company, allowed_departments')
                        .eq('college', user.college)
                        .eq('status', 'active')
                        .lte('min_cgpa', user.ug_cgpa)
                        .limit(25);
                    data = fallback.data?.map((opp: any) => ({ ...opp, deadline: null }));
                    error = fallback.error;
                }

                if (error) {
                    handleAiInvocationError(error); // Use centralized error handler
                    throw error;
                }
                
                const eligibleDeadlines = ((data || []) as Opportunity[])
                    .filter(opp => {
                        const allowed = opp.allowed_departments || [];
                        return allowed.includes('All') || allowed.includes(normalizedUserDepartment || '');
                    })
                    .slice(0, 5);
                setDeadlines(eligibleDeadlines);
            } catch (error: any) {
                // handleAiInvocationError already toasts, no need for console.error here
            } finally {
                setLoading(false);
            }
        };

        fetchDeadlines();
    }, [user, supabase]); // Add supabase to dependency array

    return (
        <Card glow="primary">
            <h2 className="font-display text-3xl text-secondary mb-4">Upcoming Deadlines</h2>
            {loading ? <Spinner /> : (
                <div className="space-y-3">
                    {deadlines.length === 0 && <p className="text-gray-400">No upcoming deadlines found for eligible opportunities.</p>}
                    {deadlines.map(opp => (
                        <div key={opp.id} className="flex justify-between items-center bg-black/30 p-3 rounded-md">
                            <div>
                                <p className="font-bold text-lg text-white">{opp.title}</p>
                                <p className="text-sm text-gray-300">{opp.company}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-primary-cyan">{opp.deadline ? new Date(opp.deadline).toLocaleDateString() : 'Open'}</p>
                                <p className="text-xs text-gray-500">Apply By</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};
