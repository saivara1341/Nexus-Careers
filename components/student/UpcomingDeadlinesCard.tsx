
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
                 // Normalize user's department name for consistent comparison
                 const normalizedUserDepartment = normalizeDepartmentName(user.department);

                 const { data, error } = await supabase
                    .from('opportunities')
                    .select('id, title, company, deadline')
                    .eq('college', user.college)
                    .eq('status', 'active')
                    .gte('deadline', today)
                    .lte('min_cgpa', user.ug_cgpa)
                    // Use normalized department in the .cs operator
                    .cs('allowed_departments', `{All,${normalizedUserDepartment}}`)
                    .order('deadline', { ascending: true })
                    .limit(5);

                if (error) {
                    handleAiInvocationError(error); // Use centralized error handler
                    throw error;
                }
                
                setDeadlines(data as Opportunity[] || []);
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
                                <p className="text-primary-cyan">{new Date(opp.deadline).toLocaleDateString()}</p>
                                <p className="text-xs text-gray-500">Apply By</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
};
