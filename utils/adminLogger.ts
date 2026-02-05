import { SupabaseClient } from '@supabase/supabase-js';

export type AdminAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'WHITELIST';
export type AdminEntity = 'opportunity' | 'student_registry' | 'department' | 'student' | 'configuration';

interface AdminLogPayload {
    admin_id: string;
    admin_name: string;
    action: AdminAction;
    entity_type: AdminEntity;
    entity_id?: string;
    details?: any;
}

/**
 * Logs an administrative action to the forensic audit trail.
 */
export const logAdminAction = async (
    supabase: SupabaseClient,
    payload: AdminLogPayload
) => {
    try {
        const { error } = await supabase
            .from('admin_logs')
            .insert({
                admin_id: payload.admin_id,
                admin_name: payload.admin_name,
                action: payload.action,
                entity_type: payload.entity_type,
                entity_id: payload.entity_id,
                details: payload.details || {}
            });

        if (error) {
            console.error('Failed to log admin action:', error);
            // Non-blocking for the main UX
        }
    } catch (err) {
        console.error('Forensic logger error:', err);
    }
};
