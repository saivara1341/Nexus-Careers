
export type AdminRole = 'CEO' | 'Chancellor' | 'Vice Chancellor' | 'University TPO' | 'Dean' | 'HOD' | 'Faculty' | 'Placement Officer';

interface BaseProfile {
    id: string;
    name: string;
    email: string;
    created_at: string;
    profile_photo_url?: string;
    is_verified?: boolean;
    verification_file_url?: string;
    biometric_registered?: boolean;
}

export interface DeveloperProfile extends BaseProfile {
    role: 'developer';
}

export interface AdminProfile extends BaseProfile {
    role: AdminRole | 'admin';
    department?: string;
    college: string;

    // MFA Fields
    mobile_number?: string;
    employee_id?: string;
    mfa_enabled?: boolean;
    mfa_method?: 'otp' | 'employee_id' | 'biometric';

    // Incubation Cell Integration
    is_incubation_lead?: boolean;
    incubation_cell_name?: string;
    incubation_services?: string[];
}

export interface StudentProfile extends BaseProfile {
    role: 'student';
    college: string;
    roll_number: string;
    department: string;
    personal_email?: string;
    mobile_number?: string;
    section?: string;
    gender?: string;
    ug_cgpa: number;
    inter_diploma_percentage?: number;
    tenth_percentage?: number;
    backlogs: number;
    ug_passout_year?: number;
    level: number;
    xp: number;
    xp_to_next_level: number;
    status?: 'Registered' | 'Provisioned';
    linkedin_profile_url?: string;
    github_profile_url?: string;
    verification_status?: 'pending' | 'verified';
    skills?: string[];
    project_details?: string;
    experience_details?: string;
}

export interface CompanyProfile extends BaseProfile {
    role: 'company';
    company_name: string;
    industry: string;
    website?: string;
    logo_url?: string;
    banner_url?: string;
    tagline?: string;
    company_size?: string;
    linkedin_url?: string;
    description?: string;
    location?: string;
    mfa_enabled?: boolean;
    mobile_number?: string;
}

export interface Opportunity {
    id: string;
    title: string;
    company: string;
    description: string;
    package_lpa?: number | null;
    min_cgpa: number;
    allowed_departments: string[];
    college: string;
    posted_by: string;
    is_corporate?: boolean;
    created_at: string;
    apply_link: string;
    jd_file_url?: string;
    deadline: string;
    assessment_start_date?: string;
    assessment_end_date?: string;
    interview_start_date?: string;
    status: 'active' | 'expired' | 'under_review' | 'archived';
    pipeline_stages?: string[];
    ai_analysis?: {
        key_skills: string[];
        resume_tips: string;
        interview_questions: string[];
        pipeline?: string[];
    } | null;
}

export interface Application {
    id: string;
    student_id: string;
    opportunity_id: string;
    status: 'applied' | 'pending_verification' | 'verified' | 'rejected' | 'shortlisted' | 'qualified' | 'offered' | 'hired' | 'verifying';
    current_stage?: string;
    rejection_reason?: string | null;
    created_at: string;
    opportunity?: Opportunity;
    student?: StudentProfile;
}

export interface IdeaSubmission {
    id: string;
    student_id: string;
    title: string;
    domain: string;
    problem_statement: string;
    proposed_solution: string;
    ai_analysis: IdeaAnalysis | null;
    created_at: string;
    pitch_status?: 'draft' | 'pitched';
    pitched_to_cell_id?: string;
    funding_requested?: number;
}

export interface IdeaAnalysis {
    noveltyScore: number;
    competitors: string[];
    feasibility: string;
    patentEligibility: string;
    roadmap: { step: string; details: string }[];
    investorPitch: string;
    marketExistence: {
        isExistent: boolean;
        details: string;
    };
}

export interface Department {
    id: string;
    name: string;
    college_name: string;
}

export interface StudentQuery {
    id: string;
    student_id: string;
    student_name: string;
    college: string;
    query_message: string;
    status: 'open' | 'in_progress' | 'resolved';
    created_at: string;
}

export interface PlatformIssue {
    id: string;
    reporter_id: string;
    reporter_name: string;
    reporter_role: string;
    description: string;
    occurred_at: string;
    screenshot_url?: string;
    status: 'Open' | 'In Progress' | 'Resolved';
    created_at: string;
}

export interface SystemVersion {
    version: string;
    build_number: string;
    deployed_at: string;
    changelog: string[];
    status: 'stable' | 'beta' | 'deprecated';
}

export interface CampusResource {
    id: string;
    lister_id: string;
    college: string;
    item_name: string;
    description: string;
    category: string;
    listing_type: 'service';
    service_rate?: number | null;
    service_rate_unit?: 'hour' | 'project' | 'session' | 'other' | 'meal' | 'piece' | 'day' | 'week' | 'month' | string | null;
    image_url: string;
    is_moderated?: boolean;
    moderation_reason?: string | null;
    created_at: string;
    availability?: {
        days: string[];
        startTime: string;
        endTime: string;
    };
    lister?: { name: string; email: string; personal_email?: string; mobile_number?: string; };
}

export interface ServiceRequest {
    id: string;
    service_id: string;
    requester_id: string;
    offerer_id: string;
    status: 'requested' | 'accepted' | 'completed' | 'cancelled';
    created_at: string;
    accepted_at?: string | null;
    completed_at?: string | null;
    service?: CampusResource;
    requester?: { name: string; email: string; personal_email?: string; mobile_number?: string; };
    offerer?: { name: string; email: string; personal_email?: string; mobile_number?: string; };
    feedback?: ServiceFeedback;
}

export interface ServiceFeedback {
    id: string;
    service_request_id: string;
    rating: number;
    feedback_text: string;
    created_at: string;
}

export interface StudentCertification {
    id: string;
    student_id: string;
    name: string;
    issuing_organization: string;
    credential_url?: string | null;
    credential_file_url?: string | null;
}

export interface StudentAchievement {
    id: string;
    student_id: string;
    description: string;
}

export interface Notification {
    id: string;
    college: string;
    recipient_department?: string | null;
    recipient_role: string;
    message: string;
    is_read: boolean;
    created_at: string;
}

export interface OpportunityReport {
    id: string;
    opportunity_id: string;
    reporter_id: string;
    reason: 'broken_link' | 'application_closed' | 'scam_fraud';
    comments?: string;
    created_at: string;
}

export interface ImHereRequest {
    id: string;
    requester_id: string;
    requester_name: string;
    requester_role: 'student' | 'admin';
    college: string;
    item_description: string;
    location_description: string;
    deadline: string;
    status: 'open' | 'accepted' | 'fulfilled' | 'cancelled';
    offerer_id?: string | null;
    offerer_name?: string | null;
    created_at: string;
    accepted_at?: string | null;
    fulfilled_at?: string | null;
}

export interface DepartmentAnnouncement {
    id: string;
    department_id: string;
    college_name: string;
    poster_id: string;
    poster_name: string;
    content: string;
    created_at: string;
}

export interface DepartmentChatMessage {
    id: string;
    department_id: string;
    sender_id: string;
    sender_name: string;
    message_text: string;
    created_at: string;
}

export interface CorporateUpdate {
    id: string;
    company_id: string;
    poster_id: string;
    poster_name: string;
    content: string;
    type?: 'update' | 'requirement' | 'blocker';
    created_at: string;
}

export interface SceneHotspot {
    id: string;
    targetSceneId: string;
    pitch: number;
    yaw: number;
    text: string;
    type: 'scene' | 'info';
}

export interface CampusScene {
    id: string;
    college: string;
    name: string;
    imageUrl: string;
    hotspots: SceneHotspot[];
    initialView?: { pitch: number; yaw: number; hfov: number };
}

export interface StagedStudent {
    name: string;
    roll_number: string;
    email: string;
    department: string;
    verificationStatus: 'new' | 'update';
    verificationMessage: string;
    parsedData: {
        name: string;
        roll_number: string;
        email: string;
        college: string;
        department: string;
        ug_cgpa: number;
        backlogs: number;
        ug_passout_year: number;
    };
}

export const GENDERS = ['Male', 'Female', 'Other'];
export const UNIVERSITY_LEVEL_ROLES: AdminRole[] = ['CEO', 'Chancellor', 'Vice Chancellor', 'University TPO', 'Dean'];
export const SERVICE_CATEGORIES = ['Food', 'Academic Help', 'Delivery', 'Print Services', 'Design', 'Photography', 'Coding Help', 'Music Lessons', 'Fitness Coaching', 'Stationary', 'Other'];
export const SERVICE_RATE_UNITS = ['hour', 'project', 'session', 'meal', 'piece', 'day', 'week', 'month', 'other'];

/**
 * Normalizes a department name to a consistent Title Case,
 * with special handling for 'All' to ensure it's always 'All'.
 * @param name The department name string.
 * @returns The normalized department name.
 */
export const normalizeDepartmentName = (name: string | null | undefined): string | null => {
    if (!name) return null;
    const trimmed = name.trim();
    if (trimmed.toLowerCase() === 'all') return 'All'; // Special handling for 'All'
    return trimmed.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
};
