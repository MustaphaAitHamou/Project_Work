export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_roles: string[];
          created_at: string;
          details: NonNullable<Json>;
          id: number;
          target_id: string | null;
          target_type: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_roles?: string[];
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_roles?: string[];
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_internal_notes: {
        Row: {
          author_id: string | null;
          created_at: string;
          id: string;
          note: string;
          target_id: string;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          created_at?: string;
          id?: string;
          note: string;
          target_id: string;
          target_type: string;
        };
        Update: {
          author_id?: string | null;
          created_at?: string;
          id?: string;
          note?: string;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_internal_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database["public"]["Enums"]["admin_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database["public"]["Enums"]["admin_role"];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database["public"]["Enums"]["admin_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      application_status_history: {
        Row: {
          actor: string;
          application_id: string;
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["application_status"] | null;
          id: number;
          to_status: Database["public"]["Enums"]["application_status"];
        };
        ComputedFields: never;
        Insert: {
          actor: string;
          application_id: string;
          changed_by?: string | null;
          created_at?: string;
          from_status?:
            | Database["public"]["Enums"]["application_status"]
            | null;
          id?: never;
          to_status: Database["public"]["Enums"]["application_status"];
        };
        Update: {
          actor?: string;
          application_id?: string;
          changed_by?: string | null;
          created_at?: string;
          from_status?:
            | Database["public"]["Enums"]["application_status"]
            | null;
          id?: never;
          to_status?: Database["public"]["Enums"]["application_status"];
        };
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: {
          anonymized_at: string | null;
          candidate_id: string | null;
          candidate_snapshot: NonNullable<Json>;
          company_id: string;
          consent_version: string;
          created_at: string;
          first_viewed_at: string | null;
          id: string;
          is_archived: boolean;
          job_id: string;
          recruiter_rating: number | null;
          resume_first_downloaded_at: string | null;
          resume_version_id: string | null;
          status: Database["public"]["Enums"]["application_status"];
          status_changed_at: string;
          updated_at: string;
          withdrawn_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          anonymized_at?: string | null;
          candidate_id?: string | null;
          candidate_snapshot: NonNullable<Json>;
          company_id: string;
          consent_version: string;
          created_at?: string;
          first_viewed_at?: string | null;
          id?: string;
          is_archived?: boolean;
          job_id: string;
          recruiter_rating?: number | null;
          resume_first_downloaded_at?: string | null;
          resume_version_id?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          status_changed_at?: string;
          updated_at?: string;
          withdrawn_at?: string | null;
        };
        Update: {
          anonymized_at?: string | null;
          candidate_id?: string | null;
          candidate_snapshot?: NonNullable<Json>;
          company_id?: string;
          consent_version?: string;
          created_at?: string;
          first_viewed_at?: string | null;
          id?: string;
          is_archived?: boolean;
          job_id?: string;
          recruiter_rating?: number | null;
          resume_first_downloaded_at?: string | null;
          resume_version_id?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          status_changed_at?: string;
          updated_at?: string;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_resume_version_id_fkey";
            columns: ["resume_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_resume_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_customers: {
        Row: {
          company_id: string;
          created_at: string;
          stripe_customer_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          stripe_customer_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          stripe_customer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_customers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_customers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_customers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
        ];
      };
      candidate_educations: {
        Row: {
          created_at: string;
          degree: string;
          description: string | null;
          end_date: string | null;
          field_of_study: string | null;
          id: string;
          school: string | null;
          start_date: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          degree: string;
          description?: string | null;
          end_date?: string | null;
          field_of_study?: string | null;
          id?: string;
          school?: string | null;
          start_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          degree?: string;
          description?: string | null;
          end_date?: string | null;
          field_of_study?: string | null;
          id?: string;
          school?: string | null;
          start_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_educations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "candidate_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      candidate_experiences: {
        Row: {
          company_name: string | null;
          created_at: string;
          description: string | null;
          end_date: string | null;
          id: string;
          is_current: boolean;
          location: string | null;
          start_date: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_name?: string | null;
          created_at?: string;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          is_current?: boolean;
          location?: string | null;
          start_date: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          company_name?: string | null;
          created_at?: string;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          is_current?: boolean;
          location?: string | null;
          start_date?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_experiences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "candidate_profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      candidate_profiles: {
        Row: {
          city: string | null;
          country_code: string | null;
          created_at: string;
          desired_contract_types: Database["public"]["Enums"]["contract_type"][];
          desired_work_time: Database["public"]["Enums"]["work_time"][];
          headline: string | null;
          languages: NonNullable<Json>;
          mobility_countries: string[];
          phone: string | null;
          region_code: string | null;
          remote_preference: Database["public"]["Enums"]["remote_preference"];
          skills: string[];
          summary: string | null;
          transmission_consent_at: string | null;
          transmission_consent_version: string | null;
          updated_at: string;
          user_id: string;
          willing_to_relocate: boolean;
          years_of_experience: number | null;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          desired_contract_types?: Database["public"]["Enums"]["contract_type"][];
          desired_work_time?: Database["public"]["Enums"]["work_time"][];
          headline?: string | null;
          languages?: NonNullable<Json>;
          mobility_countries?: string[];
          phone?: string | null;
          region_code?: string | null;
          remote_preference?: Database["public"]["Enums"]["remote_preference"];
          skills?: string[];
          summary?: string | null;
          transmission_consent_at?: string | null;
          transmission_consent_version?: string | null;
          updated_at?: string;
          user_id: string;
          willing_to_relocate?: boolean;
          years_of_experience?: number | null;
        };
        Update: {
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          desired_contract_types?: Database["public"]["Enums"]["contract_type"][];
          desired_work_time?: Database["public"]["Enums"]["work_time"][];
          headline?: string | null;
          languages?: NonNullable<Json>;
          mobility_countries?: string[];
          phone?: string | null;
          region_code?: string | null;
          remote_preference?: Database["public"]["Enums"]["remote_preference"];
          skills?: string[];
          summary?: string | null;
          transmission_consent_at?: string | null;
          transmission_consent_version?: string | null;
          updated_at?: string;
          user_id?: string;
          willing_to_relocate?: boolean;
          years_of_experience?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "candidate_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_resume_versions: {
        Row: {
          created_at: string;
          file_deleted_at: string | null;
          id: string;
          mime_type: string;
          original_filename: string;
          resume_id: string;
          scan_details: NonNullable<Json>;
          scan_status: Database["public"]["Enums"]["resume_scan_status"];
          sha256: string;
          size_bytes: number;
          storage_path: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          file_deleted_at?: string | null;
          id?: string;
          mime_type: string;
          original_filename: string;
          resume_id: string;
          scan_details?: NonNullable<Json>;
          scan_status?: Database["public"]["Enums"]["resume_scan_status"];
          sha256: string;
          size_bytes: number;
          storage_path: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          file_deleted_at?: string | null;
          id?: string;
          mime_type?: string;
          original_filename?: string;
          resume_id?: string;
          scan_details?: NonNullable<Json>;
          scan_status?: Database["public"]["Enums"]["resume_scan_status"];
          sha256?: string;
          size_bytes?: number;
          storage_path?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_resume_versions_resume_id_fkey";
            columns: ["resume_id"];
            isOneToOne: false;
            referencedRelation: "candidate_resumes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_resume_versions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_resumes: {
        Row: {
          created_at: string;
          current_version_id: string | null;
          deleted_at: string | null;
          id: string;
          is_primary: boolean;
          label: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          current_version_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_primary?: boolean;
          label?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_version_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_primary?: boolean;
          label?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_resumes_current_version_fk";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "candidate_resume_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_resumes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          display_name: string | null;
          hq_address_line1: string;
          hq_address_line2: string | null;
          hq_city: string;
          hq_country: string;
          hq_postal_code: string | null;
          hq_region: string | null;
          id: string;
          industry: string;
          legal_name: string;
          logo_path: string | null;
          registration_country: string;
          registration_id_type: string;
          registration_number: string;
          registration_region: string | null;
          secondary_identifiers: NonNullable<Json>;
          size_range: string | null;
          slug: string;
          suspended_at: string | null;
          suspension_reason: string | null;
          updated_at: string;
          verification_message: string | null;
          verification_status: Database["public"]["Enums"]["company_verification_status"];
          verified_at: string | null;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          display_name?: string | null;
          hq_address_line1: string;
          hq_address_line2?: string | null;
          hq_city: string;
          hq_country: string;
          hq_postal_code?: string | null;
          hq_region?: string | null;
          id?: string;
          industry: string;
          legal_name: string;
          logo_path?: string | null;
          registration_country: string;
          registration_id_type: string;
          registration_number: string;
          registration_region?: string | null;
          secondary_identifiers?: NonNullable<Json>;
          size_range?: string | null;
          slug: string;
          suspended_at?: string | null;
          suspension_reason?: string | null;
          updated_at?: string;
          verification_message?: string | null;
          verification_status?: Database["public"]["Enums"]["company_verification_status"];
          verified_at?: string | null;
          website?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          display_name?: string | null;
          hq_address_line1?: string;
          hq_address_line2?: string | null;
          hq_city?: string;
          hq_country?: string;
          hq_postal_code?: string | null;
          hq_region?: string | null;
          id?: string;
          industry?: string;
          legal_name?: string;
          logo_path?: string | null;
          registration_country?: string;
          registration_id_type?: string;
          registration_number?: string;
          registration_region?: string | null;
          secondary_identifiers?: NonNullable<Json>;
          size_range?: string | null;
          slug?: string;
          suspended_at?: string | null;
          suspension_reason?: string | null;
          updated_at?: string;
          verification_message?: string | null;
          verification_status?: Database["public"]["Enums"]["company_verification_status"];
          verified_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "companies_hq_country_fkey";
            columns: ["hq_country"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "companies_industry_fkey";
            columns: ["industry"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "companies_registration_country_fkey";
            columns: ["registration_country"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string;
          is_legal_representative: boolean;
          job_title: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["company_member_role"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          is_legal_representative?: boolean;
          job_title?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["company_member_role"];
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          is_legal_representative?: boolean;
          job_title?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["company_member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "company_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      company_verification_documents: {
        Row: {
          company_id: string;
          created_at: string;
          doc_type: string;
          file_deleted_at: string | null;
          id: string;
          mime_type: string;
          original_filename: string;
          purge_after: string | null;
          sha256: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          company_id: string;
          created_at?: string;
          doc_type: string;
          file_deleted_at?: string | null;
          id?: string;
          mime_type: string;
          original_filename: string;
          purge_after?: string | null;
          sha256: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by?: string | null;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          doc_type?: string;
          file_deleted_at?: string | null;
          id?: string;
          mime_type?: string;
          original_filename?: string;
          purge_after?: string | null;
          sha256?: string;
          size_bytes?: number;
          storage_path?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "company_verification_documents_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_verification_documents_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_verification_documents_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "company_verification_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      company_verifications: {
        Row: {
          checks: NonNullable<Json>;
          company_id: string;
          created_at: string;
          decision_reason: string | null;
          id: string;
          method: string;
          outcome: Database["public"]["Enums"]["company_verification_status"];
          provider: string | null;
          purge_after: string | null;
          registry_active: boolean | null;
          registry_data: NonNullable<Json>;
          registry_found: boolean | null;
          registry_name: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          risk_flags: string[];
          score: number | null;
          submitted_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          checks?: NonNullable<Json>;
          company_id: string;
          created_at?: string;
          decision_reason?: string | null;
          id?: string;
          method: string;
          outcome: Database["public"]["Enums"]["company_verification_status"];
          provider?: string | null;
          purge_after?: string | null;
          registry_active?: boolean | null;
          registry_data?: NonNullable<Json>;
          registry_found?: boolean | null;
          registry_name?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          risk_flags?: string[];
          score?: number | null;
          submitted_by?: string | null;
        };
        Update: {
          checks?: NonNullable<Json>;
          company_id?: string;
          created_at?: string;
          decision_reason?: string | null;
          id?: string;
          method?: string;
          outcome?: Database["public"]["Enums"]["company_verification_status"];
          provider?: string | null;
          purge_after?: string | null;
          registry_active?: boolean | null;
          registry_data?: NonNullable<Json>;
          registry_found?: boolean | null;
          registry_name?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          risk_flags?: string[];
          score?: number | null;
          submitted_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "company_verifications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_verifications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_verifications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "company_verifications_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_verifications_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      countries: {
        Row: {
          auto_verification_enabled: boolean;
          code: string;
          compliance_notes: string | null;
          compliance_status: string;
          created_at: string;
          default_currency: string;
          default_locale: string;
          is_browsable: boolean;
          is_paid_publishing_enabled: boolean;
          is_registration_open: boolean;
          phone_prefix: string | null;
          registry_identifier_types: string[];
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          auto_verification_enabled?: boolean;
          code: string;
          compliance_notes?: string | null;
          compliance_status?: string;
          created_at?: string;
          default_currency: string;
          default_locale: string;
          is_browsable?: boolean;
          is_paid_publishing_enabled?: boolean;
          is_registration_open?: boolean;
          phone_prefix?: string | null;
          registry_identifier_types?: string[];
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          auto_verification_enabled?: boolean;
          code?: string;
          compliance_notes?: string | null;
          compliance_status?: string;
          created_at?: string;
          default_currency?: string;
          default_locale?: string;
          is_browsable?: boolean;
          is_paid_publishing_enabled?: boolean;
          is_registration_open?: boolean;
          phone_prefix?: string | null;
          registry_identifier_types?: string[];
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "countries_default_currency_fkey";
            columns: ["default_currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      country_compliance_items: {
        Row: {
          country_code: string;
          evidence_url: string | null;
          id: string;
          is_blocking: boolean;
          item_key: string;
          notes: string | null;
          status: Database["public"]["Enums"]["compliance_item_status"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          country_code: string;
          evidence_url?: string | null;
          id?: string;
          is_blocking?: boolean;
          item_key: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["compliance_item_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          country_code?: string;
          evidence_url?: string | null;
          id?: string;
          is_blocking?: boolean;
          item_key?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["compliance_item_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "country_compliance_items_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      currencies: {
        Row: {
          code: string;
          created_at: string;
          is_active: boolean;
          minor_units: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          is_active?: boolean;
          minor_units?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          is_active?: boolean;
          minor_units?: number;
        };
        Relationships: [];
      };
      data_access_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_kind: string;
          context: NonNullable<Json>;
          created_at: string;
          id: number;
          resource_id: string;
          resource_type: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_kind: string;
          context?: NonNullable<Json>;
          created_at?: string;
          id?: never;
          resource_id: string;
          resource_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_kind?: string;
          context?: NonNullable<Json>;
          created_at?: string;
          id?: never;
          resource_id?: string;
          resource_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "data_access_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      email_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          dedupe_key: string | null;
          id: string;
          last_error: string | null;
          locale: string;
          locked_at: string | null;
          payload: NonNullable<Json>;
          provider: string | null;
          provider_message_id: string | null;
          send_after: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["email_status"];
          template: string;
          to_email: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          last_error?: string | null;
          locale?: string;
          locked_at?: string | null;
          payload?: NonNullable<Json>;
          provider?: string | null;
          provider_message_id?: string | null;
          send_after?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["email_status"];
          template: string;
          to_email: string;
          user_id?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          id?: string;
          last_error?: string | null;
          locale?: string;
          locked_at?: string | null;
          payload?: NonNullable<Json>;
          provider?: string | null;
          provider_message_id?: string | null;
          send_after?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["email_status"];
          template?: string;
          to_email?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_outbox_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      email_templates: {
        Row: {
          body: string;
          is_active: boolean;
          locale: string;
          subject: string;
          template: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          is_active?: boolean;
          locale: string;
          subject: string;
          template: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          body?: string;
          is_active?: boolean;
          locale?: string;
          subject?: string;
          template?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_templates_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      geo_cities: {
        Row: {
          country_code: string;
          id: number;
          latitude: number;
          longitude: number;
          name: string;
          name_normalized: string | null;
          region_code: string | null;
        };
        ComputedFields: never;
        Insert: {
          country_code: string;
          id?: never;
          latitude: number;
          longitude: number;
          name: string;
          name_normalized?: never;
          region_code?: string | null;
        };
        Update: {
          country_code?: string;
          id?: never;
          latitude?: number;
          longitude?: number;
          name?: string;
          name_normalized?: never;
          region_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "geo_cities_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "geo_cities_country_code_region_code_fkey";
            columns: ["country_code", "region_code"];
            isOneToOne: false;
            referencedRelation: "geo_regions";
            referencedColumns: ["country_code", "code"];
          },
        ];
      };
      geo_regions: {
        Row: {
          code: string;
          country_code: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          country_code: string;
          name: string;
        };
        Update: {
          code?: string;
          country_code?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "geo_regions_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      industries: {
        Row: {
          code: string;
          is_active: boolean;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: {
          code?: string;
          is_active?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          amount_due: number | null;
          amount_paid: number | null;
          amount_remaining: number | null;
          attempt_count: number | null;
          billing_reason: string | null;
          company_id: string;
          created_at: string;
          currency: string | null;
          hosted_invoice_url: string | null;
          id: string;
          invoice_pdf: string | null;
          job_id: string | null;
          number: string | null;
          period_end: string | null;
          period_start: string | null;
          status: string | null;
          stripe_created_at: string | null;
          stripe_invoice_id: string;
          subscription_id: string | null;
          subtotal: number | null;
          tax: number | null;
          total: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_due?: number | null;
          amount_paid?: number | null;
          amount_remaining?: number | null;
          attempt_count?: number | null;
          billing_reason?: string | null;
          company_id: string;
          created_at?: string;
          currency?: string | null;
          hosted_invoice_url?: string | null;
          id?: string;
          invoice_pdf?: string | null;
          job_id?: string | null;
          number?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          status?: string | null;
          stripe_created_at?: string | null;
          stripe_invoice_id: string;
          subscription_id?: string | null;
          subtotal?: number | null;
          tax?: number | null;
          total?: number | null;
          updated_at?: string;
        };
        Update: {
          amount_due?: number | null;
          amount_paid?: number | null;
          amount_remaining?: number | null;
          attempt_count?: number | null;
          billing_reason?: string | null;
          company_id?: string;
          created_at?: string;
          currency?: string | null;
          hosted_invoice_url?: string | null;
          id?: string;
          invoice_pdf?: string | null;
          job_id?: string | null;
          number?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          status?: string | null;
          stripe_created_at?: string | null;
          stripe_invoice_id?: string;
          subscription_id?: string | null;
          subtotal?: number | null;
          tax?: number | null;
          total?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "invoices_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      job_alerts: {
        Row: {
          created_at: string;
          criteria: NonNullable<Json>;
          email_enabled: boolean;
          frequency: Database["public"]["Enums"]["alert_frequency"];
          id: string;
          last_run_at: string | null;
          last_sent_at: string | null;
          name: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          criteria?: NonNullable<Json>;
          email_enabled?: boolean;
          frequency?: Database["public"]["Enums"]["alert_frequency"];
          id?: string;
          last_run_at?: string | null;
          last_sent_at?: string | null;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          criteria?: NonNullable<Json>;
          email_enabled?: boolean;
          frequency?: Database["public"]["Enums"]["alert_frequency"];
          id?: string;
          last_run_at?: string | null;
          last_sent_at?: string | null;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_alerts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      job_locations: {
        Row: {
          address_line: string | null;
          city: string;
          city_id: number | null;
          company_id: string;
          country_code: string;
          created_at: string;
          id: string;
          is_primary: boolean;
          job_id: string;
          latitude: number | null;
          longitude: number | null;
          postal_code: string | null;
          region_code: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address_line?: string | null;
          city: string;
          city_id?: number | null;
          company_id: string;
          country_code: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          job_id: string;
          latitude?: number | null;
          longitude?: number | null;
          postal_code?: string | null;
          region_code?: string | null;
          updated_at?: string;
        };
        Update: {
          address_line?: string | null;
          city?: string;
          city_id?: number | null;
          company_id?: string;
          country_code?: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          job_id?: string;
          latitude?: number | null;
          longitude?: number | null;
          postal_code?: string | null;
          region_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_locations_city_id_fkey";
            columns: ["city_id"];
            isOneToOne: false;
            referencedRelation: "geo_cities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_locations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_locations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_locations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "job_locations_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "job_locations_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_locations_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          application_deadline: string | null;
          benefits: string | null;
          closed_at: string | null;
          company_id: string;
          contract_type: Database["public"]["Enums"]["contract_type"];
          created_at: string;
          created_by: string | null;
          description: string;
          eligibility_notes: string | null;
          experience_level: Database["public"]["Enums"]["experience_level"];
          expired_at: string | null;
          id: string;
          industry: string | null;
          missions: string | null;
          moderation_approved_hash: string | null;
          moderation_flags: string[];
          optional_skills: string[];
          paid_through: string | null;
          positions_count: number | null;
          profile_sought: string | null;
          public_id: string;
          published_at: string | null;
          rejection_reason: string | null;
          remote_countries: string[];
          remote_scope: Database["public"]["Enums"]["remote_scope"] | null;
          required_skills: string[];
          salary_currency: string | null;
          salary_max: number | null;
          salary_max_annual: number | null;
          salary_min: number | null;
          salary_min_annual: number | null;
          salary_period: Database["public"]["Enums"]["salary_period"] | null;
          search_vector: unknown;
          slug: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["job_status"];
          suspended_at: string | null;
          suspension_reason: string | null;
          title: string;
          updated_at: string;
          work_authorization: Database["public"]["Enums"]["work_authorization"];
          work_mode: Database["public"]["Enums"]["work_mode"];
          work_time: Database["public"]["Enums"]["work_time"];
          working_languages: string[];
        };
        ComputedFields: never;
        Insert: {
          application_deadline?: string | null;
          benefits?: string | null;
          closed_at?: string | null;
          company_id: string;
          contract_type: Database["public"]["Enums"]["contract_type"];
          created_at?: string;
          created_by?: string | null;
          description: string;
          eligibility_notes?: string | null;
          experience_level: Database["public"]["Enums"]["experience_level"];
          expired_at?: string | null;
          id?: string;
          industry?: string | null;
          missions?: string | null;
          moderation_approved_hash?: string | null;
          moderation_flags?: string[];
          optional_skills?: string[];
          paid_through?: string | null;
          positions_count?: number | null;
          profile_sought?: string | null;
          public_id?: string;
          published_at?: string | null;
          rejection_reason?: string | null;
          remote_countries?: string[];
          remote_scope?: Database["public"]["Enums"]["remote_scope"] | null;
          required_skills?: string[];
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_max_annual?: number | null;
          salary_min?: number | null;
          salary_min_annual?: number | null;
          salary_period?: Database["public"]["Enums"]["salary_period"] | null;
          search_vector?: unknown;
          slug?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          suspended_at?: string | null;
          suspension_reason?: string | null;
          title: string;
          updated_at?: string;
          work_authorization?: Database["public"]["Enums"]["work_authorization"];
          work_mode?: Database["public"]["Enums"]["work_mode"];
          work_time?: Database["public"]["Enums"]["work_time"];
          working_languages?: string[];
        };
        Update: {
          application_deadline?: string | null;
          benefits?: string | null;
          closed_at?: string | null;
          company_id?: string;
          contract_type?: Database["public"]["Enums"]["contract_type"];
          created_at?: string;
          created_by?: string | null;
          description?: string;
          eligibility_notes?: string | null;
          experience_level?: Database["public"]["Enums"]["experience_level"];
          expired_at?: string | null;
          id?: string;
          industry?: string | null;
          missions?: string | null;
          moderation_approved_hash?: string | null;
          moderation_flags?: string[];
          optional_skills?: string[];
          paid_through?: string | null;
          positions_count?: number | null;
          profile_sought?: string | null;
          public_id?: string;
          published_at?: string | null;
          rejection_reason?: string | null;
          remote_countries?: string[];
          remote_scope?: Database["public"]["Enums"]["remote_scope"] | null;
          required_skills?: string[];
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_max_annual?: number | null;
          salary_min?: number | null;
          salary_min_annual?: number | null;
          salary_period?: Database["public"]["Enums"]["salary_period"] | null;
          search_vector?: unknown;
          slug?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          suspended_at?: string | null;
          suspension_reason?: string | null;
          title?: string;
          updated_at?: string;
          work_authorization?: Database["public"]["Enums"]["work_authorization"];
          work_mode?: Database["public"]["Enums"]["work_mode"];
          work_time?: Database["public"]["Enums"]["work_time"];
          working_languages?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "jobs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_industry_fkey";
            columns: ["industry"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "jobs_salary_currency_fkey";
            columns: ["salary_currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      moderation_terms: {
        Row: {
          category: string;
          code: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          language: string | null;
          pattern: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          language?: string | null;
          pattern: string;
        };
        Update: {
          category?: string;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          language?: string | null;
          pattern?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_terms_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          data: NonNullable<Json>;
          id: string;
          read_at: string | null;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          read_at?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          read_at?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          amount_refunded: number;
          attempt_number: number;
          company_id: string;
          created_at: string;
          currency: string;
          failure_code: string | null;
          failure_message: string | null;
          id: string;
          job_id: string | null;
          status: string;
          stripe_invoice_id: string;
          stripe_payment_intent_id: string | null;
          subscription_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          amount_refunded?: number;
          attempt_number?: number;
          company_id: string;
          created_at?: string;
          currency: string;
          failure_code?: string | null;
          failure_message?: string | null;
          id?: string;
          job_id?: string | null;
          status: string;
          stripe_invoice_id: string;
          stripe_payment_intent_id?: string | null;
          subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          amount_refunded?: number;
          attempt_number?: number;
          company_id?: string;
          created_at?: string;
          currency?: string;
          failure_code?: string | null;
          failure_message?: string | null;
          id?: string;
          job_id?: string | null;
          status?: string;
          stripe_invoice_id?: string;
          stripe_payment_intent_id?: string | null;
          subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "payments_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_settings: {
        Row: {
          description: string | null;
          is_public: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          description?: string | null;
          is_public?: boolean;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          description?: string | null;
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      pricing_plans: {
        Row: {
          billing_interval: string;
          code: string;
          country_code: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          is_active: boolean;
          notes: string | null;
          stripe_price_id: string | null;
          stripe_product_id: string | null;
          tax_behavior: string;
          unit_amount: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          billing_interval?: string;
          code?: string;
          country_code?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          stripe_price_id?: string | null;
          stripe_product_id?: string | null;
          tax_behavior?: string;
          unit_amount: number;
          updated_at?: string;
        };
        Update: {
          billing_interval?: string;
          code?: string;
          country_code?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          is_active?: boolean;
          notes?: string | null;
          stripe_price_id?: string | null;
          stripe_product_id?: string | null;
          tax_behavior?: string;
          unit_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_plans_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "pricing_plans_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      privacy_requests: {
        Row: {
          created_at: string;
          details: string | null;
          due_at: string;
          email: string;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          response: string | null;
          status: Database["public"]["Enums"]["privacy_request_status"];
          type: Database["public"]["Enums"]["privacy_request_type"];
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          due_at?: string;
          email: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          response?: string | null;
          status?: Database["public"]["Enums"]["privacy_request_status"];
          type: Database["public"]["Enums"]["privacy_request_type"];
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          due_at?: string;
          email?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          response?: string | null;
          status?: Database["public"]["Enums"]["privacy_request_status"];
          type?: Database["public"]["Enums"]["privacy_request_type"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "privacy_requests_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "privacy_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          hits: number;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          hits?: number;
          key: string;
          window_start: string;
        };
        Update: {
          hits?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      refunds: {
        Row: {
          amount: number;
          company_id: string;
          created_at: string;
          currency: string;
          id: string;
          payment_id: string | null;
          reason: string | null;
          requested_by: string | null;
          status: string | null;
          stripe_payment_intent_id: string | null;
          stripe_refund_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          company_id: string;
          created_at?: string;
          currency: string;
          id?: string;
          payment_id?: string | null;
          reason?: string | null;
          requested_by?: string | null;
          status?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_refund_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          company_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          payment_id?: string | null;
          reason?: string | null;
          requested_by?: string | null;
          status?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_refund_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "refunds_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          company_id: string | null;
          created_at: string;
          details: string | null;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          job_id: string | null;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_email: string | null;
          reporter_id: string | null;
          resolution_note: string | null;
          status: Database["public"]["Enums"]["report_status"];
        };
        ComputedFields: never;
        Insert: {
          company_id?: string | null;
          created_at?: string;
          details?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          job_id?: string | null;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_email?: string | null;
          reporter_id?: string | null;
          resolution_note?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          details?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          job_id?: string | null;
          reason?: Database["public"]["Enums"]["report_reason"];
          reporter_email?: string | null;
          reporter_id?: string | null;
          resolution_note?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Relationships: [
          {
            foreignKeyName: "reports_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "reports_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_jobs: {
        Row: {
          created_at: string;
          job_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          job_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          job_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_jobs_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      service_api_clients: {
        Row: {
          allowed_ips: string[];
          created_at: string;
          created_by: string | null;
          id: string;
          last_used_at: string | null;
          name: string;
          revoked_at: string | null;
          scopes: string[];
          token_hash: string;
          token_prefix: string;
        };
        ComputedFields: never;
        Insert: {
          allowed_ips?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_used_at?: string | null;
          name: string;
          revoked_at?: string | null;
          scopes?: string[];
          token_hash: string;
          token_prefix: string;
        };
        Update: {
          allowed_ips?: string[];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_used_at?: string | null;
          name?: string;
          revoked_at?: string | null;
          scopes?: string[];
          token_hash?: string;
          token_prefix?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_api_clients_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          attempts: number;
          id: string;
          last_error: string | null;
          livemode: boolean;
          payload: Json | null;
          processed_at: string | null;
          received_at: string;
          stripe_created: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          id: string;
          last_error?: string | null;
          livemode: boolean;
          payload?: Json | null;
          processed_at?: string | null;
          received_at?: string;
          stripe_created: string;
          type: string;
        };
        Update: {
          attempts?: number;
          id?: string;
          last_error?: string | null;
          livemode?: boolean;
          payload?: Json | null;
          processed_at?: string | null;
          received_at?: string;
          stripe_created?: string;
          type?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          cancel_requested_at: string | null;
          canceled_at: string | null;
          company_id: string;
          created_at: string;
          currency: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          ended_at: string | null;
          grace_until: string | null;
          id: string;
          job_id: string;
          last_event_created: string | null;
          livemode: boolean | null;
          pricing_plan_id: string | null;
          status: string;
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          unit_amount: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cancel_at_period_end?: boolean;
          cancel_requested_at?: string | null;
          canceled_at?: string | null;
          company_id: string;
          created_at?: string;
          currency?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          ended_at?: string | null;
          grace_until?: string | null;
          id?: string;
          job_id: string;
          last_event_created?: string | null;
          livemode?: boolean | null;
          pricing_plan_id?: string | null;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          unit_amount?: number | null;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          cancel_requested_at?: string | null;
          canceled_at?: string | null;
          company_id?: string;
          created_at?: string;
          currency?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          ended_at?: string | null;
          grace_until?: string | null;
          id?: string;
          job_id?: string;
          last_event_created?: string | null;
          livemode?: boolean | null;
          pricing_plan_id?: string | null;
          status?: string;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          unit_amount?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["company_id"];
          },
          {
            foreignKeyName: "subscriptions_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "subscriptions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "public_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_pricing_plan_id_fkey";
            columns: ["pricing_plan_id"];
            isOneToOne: false;
            referencedRelation: "pricing_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"];
          created_at: string;
          deleted_at: string | null;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          locale: string;
          notify_application_updates: boolean;
          notify_billing: boolean;
          notify_job_alerts: boolean;
          status: Database["public"]["Enums"]["user_status"];
          suspended_reason: string | null;
          terms_accepted_at: string | null;
          terms_version: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"];
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          first_name?: string;
          id: string;
          last_name?: string;
          locale?: string;
          notify_application_updates?: boolean;
          notify_billing?: boolean;
          notify_job_alerts?: boolean;
          status?: Database["public"]["Enums"]["user_status"];
          suspended_reason?: string | null;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          updated_at?: string;
        };
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"];
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          locale?: string;
          notify_application_updates?: boolean;
          notify_billing?: boolean;
          notify_job_alerts?: boolean;
          status?: Database["public"]["Enums"]["user_status"];
          suspended_reason?: string | null;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_companies: {
        Row: {
          active_jobs_count: number | null;
          country_code: string;
          description: string | null;
          hq_city: string;
          id: string;
          industry: string;
          logo_path: string | null;
          name: string | null;
          size_range: string | null;
          slug: string;
          verified_at: string | null;
          website: string | null;
        };
        ComputedFields: never;
        Insert: {
          active_jobs_count?: never;
          country_code?: string | null;
          description?: string | null;
          hq_city?: string | null;
          id?: string | null;
          industry?: string | null;
          logo_path?: string | null;
          name?: never;
          size_range?: string | null;
          slug?: string | null;
          verified_at?: string | null;
          website?: string | null;
        };
        Update: {
          active_jobs_count?: never;
          country_code?: string | null;
          description?: string | null;
          hq_city?: string | null;
          id?: string | null;
          industry?: string | null;
          logo_path?: string | null;
          name?: never;
          size_range?: string | null;
          slug?: string | null;
          verified_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "companies_industry_fkey";
            columns: ["industry"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "companies_registration_country_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
        ];
      };
      public_jobs: {
        Row: {
          address_line: string | null;
          application_deadline: string | null;
          benefits: string | null;
          city: string;
          closed_at: string | null;
          company_id: string;
          company_logo_path: string | null;
          company_name: string | null;
          company_slug: string;
          company_website: string | null;
          contract_type: Database["public"]["Enums"]["contract_type"];
          country_code: string;
          description: string;
          eligibility_notes: string | null;
          experience_level: Database["public"]["Enums"]["experience_level"];
          expired_at: string | null;
          id: string;
          industry: string | null;
          is_open: boolean | null;
          latitude: number | null;
          longitude: number | null;
          missions: string | null;
          optional_skills: string[];
          paid_through: string | null;
          positions_count: number | null;
          postal_code: string | null;
          profile_sought: string | null;
          public_id: string;
          published_at: string | null;
          region_code: string | null;
          remote_countries: string[];
          remote_scope: Database["public"]["Enums"]["remote_scope"] | null;
          required_skills: string[];
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          salary_period: Database["public"]["Enums"]["salary_period"] | null;
          slug: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["job_status"];
          title: string;
          updated_at: string;
          work_authorization: Database["public"]["Enums"]["work_authorization"];
          work_mode: Database["public"]["Enums"]["work_mode"];
          work_time: Database["public"]["Enums"]["work_time"];
          working_languages: string[];
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "job_locations_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "jobs_salary_currency_fkey";
            columns: ["salary_currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
    };
    Functions: {
      admin_create_service_client: {
        Args: {
          p_allowed_ips?: string[];
          p_name: string;
          p_scopes: string[];
          p_token_hash: string;
          p_token_prefix: string;
        };
        Returns: string;
      };
      admin_dashboard_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      admin_deactivate_pricing_plan: {
        Args: { p_plan_id: string };
        Returns: undefined;
      };
      admin_delete_email_template: {
        Args: { p_locale: string; p_template: string };
        Returns: undefined;
      };
      admin_handle_privacy_request: {
        Args: {
          p_request_id: string;
          p_response: string;
          p_status: Database["public"]["Enums"]["privacy_request_status"];
        };
        Returns: undefined;
      };
      admin_handle_report: {
        Args: {
          p_note: string;
          p_report_id: string;
          p_status: Database["public"]["Enums"]["report_status"];
        };
        Returns: undefined;
      };
      admin_moderate_job: {
        Args: {
          p_decision: string;
          p_internal_note?: string;
          p_job_id: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_review_company: {
        Args: {
          p_company_id: string;
          p_decision: string;
          p_internal_note?: string;
          p_message?: string;
        };
        Returns: undefined;
      };
      admin_revoke_service_client: {
        Args: { p_id: string };
        Returns: undefined;
      };
      admin_set_company_suspension: {
        Args: {
          p_company_id: string;
          p_internal_note?: string;
          p_reason: string;
          p_suspend: boolean;
        };
        Returns: Json;
      };
      admin_set_role: {
        Args: {
          p_grant: boolean;
          p_role: Database["public"]["Enums"]["admin_role"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      admin_set_user_status: {
        Args: {
          p_reason: string;
          p_status: Database["public"]["Enums"]["user_status"];
          p_user_id: string;
        };
        Returns: undefined;
      };
      admin_timeseries: {
        Args: { p_weeks?: number };
        Returns: {
          applications: number;
          candidates: number;
          employers: number;
          jobs_published: number;
          revenue: Json;
          subscriptions: number;
          week_start: string;
        }[];
      };
      admin_update_compliance_item: {
        Args: {
          p_evidence_url?: string;
          p_id: string;
          p_notes: string;
          p_status: Database["public"]["Enums"]["compliance_item_status"];
        };
        Returns: undefined;
      };
      admin_update_country: {
        Args: { p: Json; p_code: string; p_override_justification?: string };
        Returns: undefined;
      };
      admin_update_setting: {
        Args: { p_key: string; p_value: Json };
        Returns: undefined;
      };
      admin_upsert_email_template: {
        Args: {
          p_body: string;
          p_is_active: boolean;
          p_locale: string;
          p_subject: string;
          p_template: string;
        };
        Returns: undefined;
      };
      admin_upsert_moderation_term: {
        Args: {
          p_category: string;
          p_code: string;
          p_description: string;
          p_id: string;
          p_is_active: boolean;
          p_language: string;
          p_pattern: string;
        };
        Returns: string;
      };
      admin_upsert_pricing_plan: {
        Args: {
          p_country: string;
          p_currency: string;
          p_notes?: string;
          p_tax_behavior: string;
          p_unit_amount: number;
        };
        Returns: string;
      };
      apply_to_job: { Args: { p_job_id: string }; Returns: Json };
      authorize_resume_download: {
        Args: { p_version_id: string };
        Returns: Json;
      };
      authorize_verification_document: {
        Args: { p_document_id: string };
        Returns: Json;
      };
      billing_begin_event: {
        Args: {
          p_created: string;
          p_id: string;
          p_livemode: boolean;
          p_payload: Json;
          p_type: string;
        };
        Returns: Json;
      };
      billing_checkout_completed: { Args: { p: Json }; Returns: Json };
      billing_finish_event: {
        Args: { p_error?: string; p_id: string };
        Returns: undefined;
      };
      billing_job_state_for_subscription: {
        Args: { p_stripe_subscription_id: string };
        Returns: Json;
      };
      billing_mark_cancel_at_period_end: {
        Args: { p_stripe_subscription_id: string; p_value: boolean };
        Returns: undefined;
      };
      billing_prepare_checkout: {
        Args: { p_actor: string; p_job_id: string };
        Returns: Json;
      };
      billing_record_invoice: { Args: { p: Json }; Returns: Json };
      billing_record_payment: { Args: { p: Json }; Returns: Json };
      billing_record_refund: { Args: { p: Json }; Returns: Json };
      billing_register_checkout: {
        Args: {
          p_customer_id: string;
          p_job_id: string;
          p_plan_id: string;
          p_session_id: string;
        };
        Returns: string;
      };
      billing_set_plan_stripe_ids: {
        Args: { p_plan_id: string; p_price_id: string; p_product_id: string };
        Returns: undefined;
      };
      billing_sync_subscription: { Args: { p: Json }; Returns: Json };
      billing_upsert_customer: {
        Args: { p_company_id: string; p_customer_id: string };
        Returns: undefined;
      };
      bootstrap_super_admin: { Args: { p_email: string }; Returns: string };
      close_job: { Args: { p_job_id: string }; Returns: Json };
      create_company: { Args: { p: Json; p_actor: string }; Returns: string };
      delete_draft_job: { Args: { p_job_id: string }; Returns: undefined };
      email_claim_batch: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          created_at: string;
          dedupe_key: string | null;
          id: string;
          last_error: string | null;
          locale: string;
          locked_at: string | null;
          payload: NonNullable<Json>;
          provider: string | null;
          provider_message_id: string | null;
          send_after: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["email_status"];
          template: string;
          to_email: string;
          user_id: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "email_outbox";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      email_complete: {
        Args: {
          p_error: string;
          p_id: string;
          p_ok: boolean;
          p_provider: string;
          p_provider_message_id: string;
        };
        Returns: undefined;
      };
      export_my_data: { Args: Record<PropertyKey, never>; Returns: Json };
      get_job_price: { Args: { p_country?: string }; Returns: Json };
      get_my_candidate_status: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      give_transmission_consent: {
        Args: { p_version: string };
        Returns: undefined;
      };
      hq_metrics: { Args: { p_from: string; p_to: string }; Returns: Json };
      privacy_prepare_account_deletion: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      recruiter_mark_viewed: {
        Args: { p_application_id: string };
        Returns: undefined;
      };
      recruiter_set_application_status: {
        Args: {
          p_application_id: string;
          p_status: Database["public"]["Enums"]["application_status"];
        };
        Returns: undefined;
      };
      recruiter_update_application: {
        Args: {
          p_application_id: string;
          p_archived?: boolean;
          p_clear_rating?: boolean;
          p_rating?: number;
        };
        Returns: undefined;
      };
      reopen_job: { Args: { p_job_id: string }; Returns: Json };
      resume_delete: {
        Args: { p_resume_id: string; p_user_id: string };
        Returns: Json;
      };
      resume_mark_files_deleted: {
        Args: { p_version_ids: string[] };
        Returns: undefined;
      };
      resume_register_version: {
        Args: {
          p_filename: string;
          p_label: string;
          p_mime_type: string;
          p_resume_id: string;
          p_scan_details?: Json;
          p_sha256: string;
          p_size_bytes: number;
          p_storage_path: string;
          p_user_id: string;
          p_version_id: string;
        };
        Returns: Json;
      };
      run_maintenance: { Args: Record<PropertyKey, never>; Returns: Json };
      search_cities: {
        Args: { p_country?: string; p_limit?: number; p_query: string };
        Returns: {
          country_code: string;
          id: number;
          latitude: number;
          longitude: number;
          name: string;
          region_code: string;
          region_name: string;
        }[];
      };
      search_jobs: {
        Args: {
          p_city?: string;
          p_company_slug?: string;
          p_contract_types?: Database["public"]["Enums"]["contract_type"][];
          p_country?: string;
          p_exclude_job_id?: string;
          p_experience_levels?: Database["public"]["Enums"]["experience_level"][];
          p_industry?: string;
          p_lang?: string;
          p_lat?: number;
          p_limit?: number;
          p_lng?: number;
          p_offset?: number;
          p_posted_within_days?: number;
          p_published_after?: string;
          p_q?: string;
          p_radius_km?: number;
          p_region?: string;
          p_remote_from?: string;
          p_salary_currency?: string;
          p_salary_min_annual?: number;
          p_sort?: string;
          p_work_modes?: Database["public"]["Enums"]["work_mode"][];
          p_work_time?: Database["public"]["Enums"]["work_time"];
          p_working_language?: string;
        };
        Returns: {
          city: string;
          company_logo_path: string;
          company_name: string;
          company_slug: string;
          contract_type: Database["public"]["Enums"]["contract_type"];
          country_code: string;
          distance_km: number;
          excerpt: string;
          experience_level: Database["public"]["Enums"]["experience_level"];
          id: string;
          public_id: string;
          published_at: string;
          rank: number;
          region_code: string;
          remote_countries: string[];
          remote_scope: Database["public"]["Enums"]["remote_scope"];
          required_skills: string[];
          salary_currency: string;
          salary_max: number;
          salary_min: number;
          salary_period: Database["public"]["Enums"]["salary_period"];
          slug: string;
          title: string;
          total_count: number;
          work_mode: Database["public"]["Enums"]["work_mode"];
          work_time: Database["public"]["Enums"]["work_time"];
        }[];
      };
      search_suggestions: {
        Args: { p_limit?: number; p_prefix: string };
        Returns: {
          kind: string;
          suggestion: string;
        }[];
      };
      service_client_authenticate: {
        Args: { p_token_hash: string };
        Returns: Json;
      };
      set_primary_resume: { Args: { p_resume_id: string }; Returns: undefined };
      similar_jobs: {
        Args: { p_job_id: string; p_limit?: number };
        Returns: {
          city: string;
          company_name: string;
          contract_type: Database["public"]["Enums"]["contract_type"];
          country_code: string;
          id: string;
          public_id: string;
          published_at: string;
          slug: string;
          title: string;
          work_mode: Database["public"]["Enums"]["work_mode"];
        }[];
      };
      submit_job: { Args: { p_job_id: string }; Returns: Json };
      update_company_registration: {
        Args: { p: Json; p_actor: string; p_company_id: string };
        Returns: undefined;
      };
      verification_documents_mark_deleted: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      verification_record_result: {
        Args: {
          p: Json;
          p_company_id: string;
          p_outcome: Database["public"]["Enums"]["company_verification_status"];
        };
        Returns: undefined;
      };
      verification_register_document: {
        Args: { p: Json; p_actor: string; p_company_id: string };
        Returns: string;
      };
      verification_start: {
        Args: { p_actor: string; p_company_id: string };
        Returns: Json;
      };
      withdraw_application: {
        Args: { p_application_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      account_type: "candidate" | "employer";
      admin_role:
        | "super_admin"
        | "verification_officer"
        | "moderator"
        | "finance"
        | "privacy_officer"
        | "support";
      alert_frequency: "daily" | "weekly";
      application_status:
        | "submitted"
        | "viewed"
        | "shortlisted"
        | "rejected"
        | "hired"
        | "job_closed"
        | "withdrawn";
      company_member_role: "owner" | "admin" | "recruiter";
      company_verification_status:
        | "pending"
        | "auto_check"
        | "manual_review"
        | "verified"
        | "rejected"
        | "suspended";
      compliance_item_status:
        | "todo"
        | "in_progress"
        | "done"
        | "not_applicable";
      contract_type:
        | "permanent"
        | "fixed_term"
        | "temporary"
        | "internship"
        | "apprenticeship"
        | "freelance"
        | "seasonal";
      email_status: "pending" | "sending" | "sent" | "failed" | "cancelled";
      experience_level:
        | "entry"
        | "junior"
        | "mid"
        | "senior"
        | "lead"
        | "executive";
      job_status:
        | "draft"
        | "pending_payment"
        | "in_review"
        | "active"
        | "suspended"
        | "expired"
        | "closed"
        | "rejected";
      privacy_request_status: "open" | "in_progress" | "completed" | "rejected";
      privacy_request_type:
        | "export"
        | "deletion"
        | "rectification"
        | "objection"
        | "restriction"
        | "other";
      remote_preference: "onsite" | "hybrid" | "remote" | "any";
      remote_scope: "employer_country" | "listed_countries" | "worldwide";
      report_reason:
        | "discrimination"
        | "fraud"
        | "scam"
        | "misleading"
        | "illegal_content"
        | "external_redirect"
        | "other";
      report_status: "open" | "in_review" | "resolved" | "dismissed";
      resume_scan_status: "pending" | "clean" | "rejected";
      salary_period: "hour" | "day" | "month" | "year";
      user_status: "active" | "suspended" | "deleted";
      work_authorization:
        | "not_specified"
        | "required"
        | "sponsorship_available";
      work_mode: "onsite" | "hybrid" | "remote";
      work_time: "full_time" | "part_time";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_type: ["candidate", "employer"],
      admin_role: [
        "super_admin",
        "verification_officer",
        "moderator",
        "finance",
        "privacy_officer",
        "support",
      ],
      alert_frequency: ["daily", "weekly"],
      application_status: [
        "submitted",
        "viewed",
        "shortlisted",
        "rejected",
        "hired",
        "job_closed",
        "withdrawn",
      ],
      company_member_role: ["owner", "admin", "recruiter"],
      company_verification_status: [
        "pending",
        "auto_check",
        "manual_review",
        "verified",
        "rejected",
        "suspended",
      ],
      compliance_item_status: ["todo", "in_progress", "done", "not_applicable"],
      contract_type: [
        "permanent",
        "fixed_term",
        "temporary",
        "internship",
        "apprenticeship",
        "freelance",
        "seasonal",
      ],
      email_status: ["pending", "sending", "sent", "failed", "cancelled"],
      experience_level: [
        "entry",
        "junior",
        "mid",
        "senior",
        "lead",
        "executive",
      ],
      job_status: [
        "draft",
        "pending_payment",
        "in_review",
        "active",
        "suspended",
        "expired",
        "closed",
        "rejected",
      ],
      privacy_request_status: ["open", "in_progress", "completed", "rejected"],
      privacy_request_type: [
        "export",
        "deletion",
        "rectification",
        "objection",
        "restriction",
        "other",
      ],
      remote_preference: ["onsite", "hybrid", "remote", "any"],
      remote_scope: ["employer_country", "listed_countries", "worldwide"],
      report_reason: [
        "discrimination",
        "fraud",
        "scam",
        "misleading",
        "illegal_content",
        "external_redirect",
        "other",
      ],
      report_status: ["open", "in_review", "resolved", "dismissed"],
      resume_scan_status: ["pending", "clean", "rejected"],
      salary_period: ["hour", "day", "month", "year"],
      user_status: ["active", "suspended", "deleted"],
      work_authorization: [
        "not_specified",
        "required",
        "sponsorship_available",
      ],
      work_mode: ["onsite", "hybrid", "remote"],
      work_time: ["full_time", "part_time"],
    },
  },
} as const;
