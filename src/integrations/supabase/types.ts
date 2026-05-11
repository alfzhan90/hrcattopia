export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      area_manager_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_manager_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          branch_id: string
          check_in_lat: number | null
          check_in_long: number | null
          check_in_time: string
          check_out_time: string | null
          created_at: string
          id: string
          late_minutes: number
          late_waived: boolean
          manager_notes: string | null
          net_hours: number
          ot_approved: boolean
          ot_hours: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          regular_hours: number
          rest_hours: number
          status: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Insert: {
          branch_id: string
          check_in_lat?: number | null
          check_in_long?: number | null
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          id?: string
          late_minutes?: number
          late_waived?: boolean
          manager_notes?: string | null
          net_hours?: number
          ot_approved?: boolean
          ot_hours?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          regular_hours?: number
          rest_hours?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id: string
        }
        Update: {
          branch_id?: string
          check_in_lat?: number | null
          check_in_long?: number | null
          check_in_time?: string
          check_out_time?: string | null
          created_at?: string
          id?: string
          late_minutes?: number
          late_waived?: boolean
          manager_notes?: string | null
          net_hours?: number
          ot_approved?: boolean
          ot_hours?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          regular_hours?: number
          rest_hours?: number
          status?: Database["public"]["Enums"]["attendance_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      branch_visits: {
        Row: {
          branch_id: string
          check_in_lat: number | null
          check_in_long: number | null
          created_at: string
          distance_from_previous_km: number
          id: string
          staff_profile_id: string
          visited_at: string
        }
        Insert: {
          branch_id: string
          check_in_lat?: number | null
          check_in_long?: number | null
          created_at?: string
          distance_from_previous_km?: number
          id?: string
          staff_profile_id: string
          visited_at?: string
        }
        Update: {
          branch_id?: string
          check_in_lat?: number | null
          check_in_long?: number | null
          created_at?: string
          distance_from_previous_km?: number
          id?: string
          staff_profile_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branch_visits_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_visits_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          created_at: string
          grace_period_minutes: number
          id: string
          latitude: number
          longitude: number
          name: string
          radius_meters: number
          scheduled_start: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          grace_period_minutes?: number
          id?: string
          latitude: number
          longitude: number
          name: string
          radius_meters?: number
          scheduled_start?: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          grace_period_minutes?: number
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
          scheduled_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string
          company_name: string
          created_at: string
          id: string
          logo_url: string | null
          phone: string
          ssm_number: string
          updated_at: string
        }
        Insert: {
          address?: string
          company_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          phone?: string
          ssm_number?: string
          updated_at?: string
        }
        Update: {
          address?: string
          company_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          phone?: string
          ssm_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      freelancer_invoices: {
        Row: {
          created_at: string
          e_invoice_id: string | null
          hourly_rate: number
          id: string
          invoice_number: string
          month: string
          payment_due_date: string | null
          service_description: string
          staff_profile_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          total_hours: number
          total_payable: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          e_invoice_id?: string | null
          hourly_rate?: number
          id?: string
          invoice_number?: string
          month: string
          payment_due_date?: string | null
          service_description?: string
          staff_profile_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_hours?: number
          total_payable?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          e_invoice_id?: string | null
          hourly_rate?: number
          id?: string
          invoice_number?: string
          month?: string
          payment_due_date?: string | null
          service_description?: string
          staff_profile_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          total_hours?: number
          total_payable?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freelancer_invoices_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          date: string
          end_date: string | null
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          mc_file_url: string | null
          notes: string | null
          reason: string | null
          staff_profile_id: string
          status: Database["public"]["Enums"]["leave_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          date: string
          end_date?: string | null
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          mc_file_url?: string | null
          notes?: string | null
          reason?: string | null
          staff_profile_id: string
          status?: Database["public"]["Enums"]["leave_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          date?: string
          end_date?: string | null
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          mc_file_url?: string | null
          notes?: string | null
          reason?: string | null
          staff_profile_id?: string
          status?: Database["public"]["Enums"]["leave_status"]
        }
        Relationships: [
          {
            foreignKeyName: "leave_records_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          allowance: number
          basic_pay: number
          commission: number
          created_at: string
          eis_employee: number
          eis_employer: number
          epf_employee: number
          epf_employer: number
          gross_pay: number
          holiday_pay: number
          id: string
          late_deduction: number
          mileage_claim: number
          month: string
          net_pay: number
          ot_pay: number
          pcb: number
          released_at: string | null
          socso_employee: number
          socso_employer: number
          staff_profile_id: string
          status: Database["public"]["Enums"]["payroll_status"]
          upl_deduction: number
        }
        Insert: {
          allowance?: number
          basic_pay?: number
          commission?: number
          created_at?: string
          eis_employee?: number
          eis_employer?: number
          epf_employee?: number
          epf_employer?: number
          gross_pay?: number
          holiday_pay?: number
          id?: string
          late_deduction?: number
          mileage_claim?: number
          month: string
          net_pay?: number
          ot_pay?: number
          pcb?: number
          released_at?: string | null
          socso_employee?: number
          socso_employer?: number
          staff_profile_id: string
          status?: Database["public"]["Enums"]["payroll_status"]
          upl_deduction?: number
        }
        Update: {
          allowance?: number
          basic_pay?: number
          commission?: number
          created_at?: string
          eis_employee?: number
          eis_employer?: number
          epf_employee?: number
          epf_employer?: number
          gross_pay?: number
          holiday_pay?: number
          id?: string
          late_deduction?: number
          mileage_claim?: number
          month?: string
          net_pay?: number
          ot_pay?: number
          pcb?: number
          released_at?: string | null
          socso_employee?: number
          socso_employer?: number
          staff_profile_id?: string
          status?: Database["public"]["Enums"]["payroll_status"]
          upl_deduction?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          multiplier: number
          name: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          multiplier?: number
          name: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          multiplier?: number
          name?: string
        }
        Relationships: []
      }
      role_history: {
        Row: {
          action_type: string
          changed_by: string
          created_at: string
          effective_date: string
          id: string
          new_rate: number
          new_role: string
          old_rate: number
          old_role: string
          reason: string | null
          staff_profile_id: string
        }
        Insert: {
          action_type?: string
          changed_by: string
          created_at?: string
          effective_date: string
          id?: string
          new_rate?: number
          new_role: string
          old_rate?: number
          old_role: string
          reason?: string | null
          staff_profile_id: string
        }
        Update: {
          action_type?: string
          changed_by?: string
          created_at?: string
          effective_date?: string
          id?: string
          new_rate?: number
          new_role?: string
          old_rate?: number
          old_role?: string
          reason?: string | null
          staff_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_history_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string
          date: string
          end_time: string
          id: string
          notes: string | null
          staff_profile_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by: string
          date: string
          end_time: string
          id?: string
          notes?: string | null
          staff_profile_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string
          date?: string
          end_time?: string
          id?: string
          notes?: string | null
          staff_profile_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_staff_profile_id_fkey"
            columns: ["staff_profile_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          access_revoke_date: string | null
          al_balance: number
          bank_account_number: string | null
          bank_name: string | null
          base_rate: number
          branch_id: string | null
          created_at: string
          device_id: string | null
          email: string | null
          employment_status: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          exit_date: string | null
          exit_reason: string | null
          freelancer_ot_enabled: boolean
          ic_number: string
          id: string
          is_device_binding_required: boolean
          kwsp_number: string | null
          leave_encashment_days: number
          mc_balance: number
          name: string
          ot_rate_per_hour: number
          passport_number: string | null
          phone_number: string | null
          privacy_tracking_enabled: boolean
          socso_number: string | null
          staff_id: string
          tax_reference_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_revoke_date?: string | null
          al_balance?: number
          bank_account_number?: string | null
          bank_name?: string | null
          base_rate?: number
          branch_id?: string | null
          created_at?: string
          device_id?: string | null
          email?: string | null
          employment_status?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          exit_date?: string | null
          exit_reason?: string | null
          freelancer_ot_enabled?: boolean
          ic_number: string
          id?: string
          is_device_binding_required?: boolean
          kwsp_number?: string | null
          leave_encashment_days?: number
          mc_balance?: number
          name: string
          ot_rate_per_hour?: number
          passport_number?: string | null
          phone_number?: string | null
          privacy_tracking_enabled?: boolean
          socso_number?: string | null
          staff_id: string
          tax_reference_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_revoke_date?: string | null
          al_balance?: number
          bank_account_number?: string | null
          bank_name?: string | null
          base_rate?: number
          branch_id?: string | null
          created_at?: string
          device_id?: string | null
          email?: string | null
          employment_status?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          exit_date?: string | null
          exit_reason?: string | null
          freelancer_ot_enabled?: boolean
          ic_number?: string
          id?: string
          is_device_binding_required?: boolean
          kwsp_number?: string | null
          leave_encashment_days?: number
          mc_balance?: number
          name?: string
          ot_rate_per_hour?: number
          passport_number?: string | null
          phone_number?: string | null
          privacy_tracking_enabled?: boolean
          socso_number?: string | null
          staff_id?: string
          tax_reference_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_area_manager_for_attendance_user: {
        Args: { _attendance_user_id: string; _manager_id: string }
        Returns: boolean
      }
      is_area_manager_for_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      is_area_manager_for_staff: {
        Args: { _staff_profile_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "area_manager"
      attendance_status: "on_time" | "late" | "out_of_range"
      employment_type:
        | "Monthly-FT"
        | "Hourly-FT"
        | "Area-Manager"
        | "Freelancer"
      invoice_status: "draft" | "issued" | "paid"
      leave_status: "pending" | "approved" | "rejected"
      leave_type: "AL" | "MC" | "UPL" | "EL"
      payment_status: "automatic" | "pending_approval" | "approved" | "rejected"
      payroll_status: "draft" | "released"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "area_manager"],
      attendance_status: ["on_time", "late", "out_of_range"],
      employment_type: [
        "Monthly-FT",
        "Hourly-FT",
        "Area-Manager",
        "Freelancer",
      ],
      invoice_status: ["draft", "issued", "paid"],
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["AL", "MC", "UPL", "EL"],
      payment_status: ["automatic", "pending_approval", "approved", "rejected"],
      payroll_status: ["draft", "released"],
    },
  },
} as const
