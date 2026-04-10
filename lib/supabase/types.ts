export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Plan = 'free' | 'starter' | 'professional' | 'business'
export type Locale = 'ko' | 'ja'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ImageStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          locale: Locale
          plan: Plan
          trial_ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: Plan
          status: SubscriptionStatus
          polar_product_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          trial_ends_at: string | null
          canceled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
      }
      usage: {
        Row: {
          id: string
          user_id: string
          period: string   // 'YYYY-MM'
          job_count: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['usage']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['usage']['Insert']>
      }
      analysis_jobs: {
        Row: {
          id: string
          user_id: string
          status: JobStatus
          image_count: number
          completed_count: number
          severity_summary: Json | null
          location_label: string | null
          locale: Locale
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['analysis_jobs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['analysis_jobs']['Insert']>
      }
      analysis_images: {
        Row: {
          id: string
          job_id: string
          user_id: string
          storage_path: string
          file_name: string
          status: ImageStatus
          crack_detections: Json | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['analysis_images']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['analysis_images']['Insert']>
      }
      reports: {
        Row: {
          id: string
          job_id: string
          user_id: string
          storage_path: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['reports']['Row'], 'id' | 'created_at'>
        Update: never
      }
    }
  }
}
