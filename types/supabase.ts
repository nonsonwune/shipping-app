export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          updated_at: string | null
          username: string | null
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          website: string | null
          created_at: string
          phone: string | null
          account_type: string | null
          email: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          website?: string | null
          created_at?: string
          phone?: string | null
          account_type?: string | null
          email?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          website?: string | null
          created_at?: string
          phone?: string | null
          account_type?: string | null
          email?: string | null
        }
      }
      shipments: {
        Row: {
          id: string
          created_at: string
          updated_at: string | null
          origin: string
          destination: string
          status: string
          tracking_number: string
          user_id: string
          estimated_delivery: string | null
          weight: number | null
          dimensions: string | null
          carrier: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string | null
          origin: string
          destination: string
          status?: string
          tracking_number: string
          user_id: string
          estimated_delivery?: string | null
          weight?: number | null
          dimensions?: string | null
          carrier?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string | null
          origin?: string
          destination?: string
          status?: string
          tracking_number?: string
          user_id?: string
          estimated_delivery?: string | null
          weight?: number | null
          dimensions?: string | null
          carrier?: string | null
        }
      }
      staff_notifications: {
        Row: {
          id: string
          shipment_id: string
          type: string
          title: string
          message: string
          required_role: string
          created_at: string
          is_read: boolean
          is_assigned: boolean
          assigned_to: string | null
        }
        Insert: {
          id?: string
          shipment_id: string
          type: string
          title: string
          message: string
          required_role: string
          created_at?: string
          is_read?: boolean
          is_assigned?: boolean
          assigned_to?: string | null
        }
        Update: {
          id?: string
          shipment_id?: string
          type?: string
          title?: string
          message?: string
          required_role?: string
          created_at?: string
          is_read?: boolean
          is_assigned?: boolean
          assigned_to?: string | null
        }
      }
      user_roles: {
        Row: {
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          user_id: string
          role?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          role?: string
          created_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          is_read: boolean
          created_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          is_read?: boolean
          created_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          is_read?: boolean
          created_at?: string
          metadata?: Json | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
