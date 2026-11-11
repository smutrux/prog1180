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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attachment: {
        Row: {
          attachment_file_name: string
          attachment_file_path: string
          attachment_id: number
          attachment_type: string | null
          attachment_uploaded_at: string
          attachment_uploaded_by_person_id: number
          ncr_id: number
        }
        Insert: {
          attachment_file_name: string
          attachment_file_path: string
          attachment_id?: never
          attachment_type?: string | null
          attachment_uploaded_at?: string
          attachment_uploaded_by_person_id: number
          ncr_id: number
        }
        Update: {
          attachment_file_name?: string
          attachment_file_path?: string
          attachment_id?: never
          attachment_type?: string | null
          attachment_uploaded_at?: string
          attachment_uploaded_by_person_id?: number
          ncr_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "attachment_attachment_uploaded_by_person_id_fkey"
            columns: ["attachment_uploaded_by_person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "attachment_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: false
            referencedRelation: "ncr"
            referencedColumns: ["ncr_id"]
          },
          {
            foreignKeyName: "attachment_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: false
            referencedRelation: "ncr_list"
            referencedColumns: ["ncr_id"]
          },
        ]
      }
      audit: {
        Row: {
          audit_action: string
          audit_id: number
          audit_notes: string | null
          audit_person_id: number
          audited_at: string
          engineering_id: number | null
          ncr_id: number
          purchasing_id: number | null
          qa_id: number | null
        }
        Insert: {
          audit_action: string
          audit_id?: never
          audit_notes?: string | null
          audit_person_id: number
          audited_at?: string
          engineering_id?: number | null
          ncr_id: number
          purchasing_id?: number | null
          qa_id?: number | null
        }
        Update: {
          audit_action?: string
          audit_id?: never
          audit_notes?: string | null
          audit_person_id?: number
          audited_at?: string
          engineering_id?: number | null
          ncr_id?: number
          purchasing_id?: number | null
          qa_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_audit_person_id_fkey"
            columns: ["audit_person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "audit_engineering_id_fkey"
            columns: ["engineering_id"]
            isOneToOne: false
            referencedRelation: "engineering"
            referencedColumns: ["engineering_id"]
          },
          {
            foreignKeyName: "audit_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: false
            referencedRelation: "ncr"
            referencedColumns: ["ncr_id"]
          },
          {
            foreignKeyName: "audit_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: false
            referencedRelation: "ncr_list"
            referencedColumns: ["ncr_id"]
          },
          {
            foreignKeyName: "audit_purchasing_id_fkey"
            columns: ["purchasing_id"]
            isOneToOne: false
            referencedRelation: "purchasing"
            referencedColumns: ["purchasing_id"]
          },
          {
            foreignKeyName: "audit_qa_id_fkey"
            columns: ["qa_id"]
            isOneToOne: false
            referencedRelation: "qa"
            referencedColumns: ["qa_id"]
          },
        ]
      }
      engineering: {
        Row: {
          disposition_id: number
          engineer_person_id: number
          engineering_date: string
          engineering_disposition_steps: string | null
          engineering_id: number
          engineering_is_drawing_update_required: boolean
          engineering_is_notification_required: boolean
          engineering_original_rev_number: string | null
          engineering_revision_date: string | null
          engineering_updated_rev_number: string | null
          ncr_id: number
        }
        Insert: {
          disposition_id: number
          engineer_person_id: number
          engineering_date: string
          engineering_disposition_steps?: string | null
          engineering_id?: never
          engineering_is_drawing_update_required: boolean
          engineering_is_notification_required: boolean
          engineering_original_rev_number?: string | null
          engineering_revision_date?: string | null
          engineering_updated_rev_number?: string | null
          ncr_id: number
        }
        Update: {
          disposition_id?: number
          engineer_person_id?: number
          engineering_date?: string
          engineering_disposition_steps?: string | null
          engineering_id?: never
          engineering_is_drawing_update_required?: boolean
          engineering_is_notification_required?: boolean
          engineering_original_rev_number?: string | null
          engineering_revision_date?: string | null
          engineering_updated_rev_number?: string | null
          ncr_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "engineering_disposition_id_fkey"
            columns: ["disposition_id"]
            isOneToOne: false
            referencedRelation: "ncr_disposition"
            referencedColumns: ["disposition_id"]
          },
          {
            foreignKeyName: "engineering_engineer_person_id_fkey"
            columns: ["engineer_person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "engineering_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: true
            referencedRelation: "ncr"
            referencedColumns: ["ncr_id"]
          },
          {
            foreignKeyName: "engineering_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: true
            referencedRelation: "ncr_list"
            referencedColumns: ["ncr_id"]
          },
        ]
      }
      item: {
        Row: {
          item_desc: string | null
          item_id: number
          item_name: string
          item_unit_price: number | null
        }
        Insert: {
          item_desc?: string | null
          item_id?: never
          item_name: string
          item_unit_price?: number | null
        }
        Update: {
          item_desc?: string | null
          item_id?: never
          item_name?: string
          item_unit_price?: number | null
        }
        Relationships: []
      }
      login: {
        Row: {
          login_id: number
          login_is_active: boolean
          login_last_login_at: string | null
          login_password_hash: string
          login_username: string
          person_id: number
        }
        Insert: {
          login_id?: never
          login_is_active?: boolean
          login_last_login_at?: string | null
          login_password_hash: string
          login_username: string
          person_id: number
        }
        Update: {
          login_id?: never
          login_is_active?: boolean
          login_last_login_at?: string | null
          login_password_hash?: string
          login_username?: string
          person_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "login_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "person"
            referencedColumns: ["person_id"]
          },
        ]
      }
      ncr: {
        Row: {
          ncr_closed_at: string | null
          ncr_created_at: string
          ncr_created_by_person_id: number
          ncr_draft_data: string | null
          ncr_draft_step: string | null
          ncr_id: number
          ncr_is_reinspectable: boolean
          ncr_number: string
          ncr_status_id: number
          so_line_item_id: number | null
        }
        Insert: {
          ncr_closed_at?: string | null
          ncr_created_at?: string
          ncr_created_by_person_id: number
          ncr_draft_data?: string | null
          ncr_draft_step?: string | null
          ncr_id?: never
          ncr_is_reinspectable?: boolean
          ncr_number: string
          ncr_status_id: number
          so_line_item_id?: number | null
        }
        Update: {
          ncr_closed_at?: string | null
          ncr_created_at?: string
          ncr_created_by_person_id?: number
          ncr_draft_data?: string | null
          ncr_draft_step?: string | null
          ncr_id?: never
          ncr_is_reinspectable?: boolean
          ncr_number?: string
          ncr_status_id?: number
          so_line_item_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ncr_ncr_created_by_person_id_fkey"
            columns: ["ncr_created_by_person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "ncr_ncr_status_id_fkey"
            columns: ["ncr_status_id"]
            isOneToOne: false
            referencedRelation: "ncr_status"
            referencedColumns: ["ncr_status_id"]
          },
          {
            foreignKeyName: "ncr_so_line_item_id_fkey"
            columns: ["so_line_item_id"]
            isOneToOne: false
            referencedRelation: "so_line_item"
            referencedColumns: ["so_line_item_id"]
          },
        ]
      }
      ncr_disposition: {
        Row: {
          disposition_id: number
          ncr_disposition_label: string
        }
        Insert: {
          disposition_id?: never
          ncr_disposition_label: string
        }
        Update: {
          disposition_id?: never
          ncr_disposition_label?: string
        }
        Relationships: []
      }
      ncr_problem_type: {
        Row: {
          ncr_id: number
          ncr_problem_type_id: number
          problem_type_id: number
        }
        Insert: {
          ncr_id: number
          ncr_problem_type_id?: never
          problem_type_id: number
        }
        Update: {
          ncr_id?: number
          ncr_problem_type_id?: never
          problem_type_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "ncr_problem_type_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: false
            referencedRelation: "ncr"
            referencedColumns: ["ncr_id"]
          },
          {
            foreignKeyName: "ncr_problem_type_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: false
            referencedRelation: "ncr_list"
            referencedColumns: ["ncr_id"]
          },
          {
            foreignKeyName: "ncr_problem_type_problem_type_id_fkey"
            columns: ["problem_type_id"]
            isOneToOne: false
            referencedRelation: "problem_type"
            referencedColumns: ["problem_type_id"]
          },
        ]
      }
      ncr_process_applicable: {
        Row: {
          ncr_process_applicable_id: number
          ncr_process_applicable_label: string
        }
        Insert: {
          ncr_process_applicable_id?: never
          ncr_process_applicable_label: string
        }
        Update: {
          ncr_process_applicable_id?: never
          ncr_process_applicable_label?: string
        }
        Relationships: []
      }
      ncr_status: {
        Row: {
          ncr_status_id: number
          ncr_status_label: string
        }
        Insert: {
          ncr_status_id?: never
          ncr_status_label: string
        }
        Update: {
          ncr_status_id?: never
          ncr_status_label?: string
        }
        Relationships: []
      }
      person: {
        Row: {
          person_email: string
          person_first_name: string
          person_id: number
          person_last_name: string
          person_middle_name: string | null
          person_phone: string | null
          role_id: number
        }
        Insert: {
          person_email: string
          person_first_name: string
          person_id?: never
          person_last_name: string
          person_middle_name?: string | null
          person_phone?: string | null
          role_id: number
        }
        Update: {
          person_email?: string
          person_first_name?: string
          person_id?: never
          person_last_name?: string
          person_middle_name?: string | null
          person_phone?: string | null
          role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "person_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "role"
            referencedColumns: ["role_id"]
          },
        ]
      }
      po_line_item: {
        Row: {
          item_id: number
          po_line_item_id: number
          po_line_item_quantity_ordered: number
          po_line_item_unit_price: number | null
          purchase_order_id: number
          so_line_item_id: number | null
        }
        Insert: {
          item_id: number
          po_line_item_id?: never
          po_line_item_quantity_ordered: number
          po_line_item_unit_price?: number | null
          purchase_order_id: number
          so_line_item_id?: number | null
        }
        Update: {
          item_id?: number
          po_line_item_id?: never
          po_line_item_quantity_ordered?: number
          po_line_item_unit_price?: number | null
          purchase_order_id?: number
          so_line_item_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "po_line_item_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "po_line_item_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["purchase_order_id"]
          },
          {
            foreignKeyName: "po_line_item_so_line_item_id_fkey"
            columns: ["so_line_item_id"]
            isOneToOne: false
            referencedRelation: "so_line_item"
            referencedColumns: ["so_line_item_id"]
          },
        ]
      }
      problem_type: {
        Row: {
          problem_type_desc: string | null
          problem_type_id: number
          problem_type_label: string
        }
        Insert: {
          problem_type_desc?: string | null
          problem_type_id?: never
          problem_type_label: string
        }
        Update: {
          problem_type_desc?: string | null
          problem_type_id?: never
          problem_type_label?: string
        }
        Relationships: []
      }
      purchase_order: {
        Row: {
          purchase_order_date: string | null
          purchase_order_id: number
          purchase_order_number: string
          supplier_id: number | null
        }
        Insert: {
          purchase_order_date?: string | null
          purchase_order_id?: never
          purchase_order_number: string
          supplier_id?: number | null
        }
        Update: {
          purchase_order_date?: string | null
          purchase_order_id?: never
          purchase_order_number?: string
          supplier_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      purchasing: {
        Row: {
          ncr_id: number
          operations_manager_date: string
          operations_manager_id: number
          purchasing_car_number: string | null
          purchasing_car_raised: boolean
          purchasing_decision_id: number
          purchasing_follow_up_expected_date: string | null
          purchasing_follow_up_required: boolean
          purchasing_follow_up_type: string | null
          purchasing_id: number
        }
        Insert: {
          ncr_id: number
          operations_manager_date: string
          operations_manager_id: number
          purchasing_car_number?: string | null
          purchasing_car_raised: boolean
          purchasing_decision_id: number
          purchasing_follow_up_expected_date?: string | null
          purchasing_follow_up_required: boolean
          purchasing_follow_up_type?: string | null
          purchasing_id?: never
        }
        Update: {
          ncr_id?: number
          operations_manager_date?: string
          operations_manager_id?: number
          purchasing_car_number?: string | null
          purchasing_car_raised?: boolean
          purchasing_decision_id?: number
          purchasing_follow_up_expected_date?: string | null
          purchasing_follow_up_required?: boolean
          purchasing_follow_up_type?: string | null
          purchasing_id?: never
        }
        Relationships: [
          {
            foreignKeyName: "purchasing_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: true
            referencedRelation: "ncr"
            referencedColumns: ["ncr_id"]
          },
          {
            foreignKeyName: "purchasing_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: true
            referencedRelation: "ncr_list"
            referencedColumns: ["ncr_id"]
          },
          {
            foreignKeyName: "purchasing_operations_manager_id_fkey"
            columns: ["operations_manager_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "purchasing_purchasing_decision_id_fkey"
            columns: ["purchasing_decision_id"]
            isOneToOne: false
            referencedRelation: "purchasing_decision"
            referencedColumns: ["purchasing_decision_id"]
          },
        ]
      }
      purchasing_decision: {
        Row: {
          purchasing_decision_id: number
          purchasing_decision_label: string
        }
        Insert: {
          purchasing_decision_id?: never
          purchasing_decision_label: string
        }
        Update: {
          purchasing_decision_id?: never
          purchasing_decision_label?: string
        }
        Relationships: []
      }
      qa: {
        Row: {
          ncr_id: number
          ncr_process_applicable_id: number
          qa_defect_desc: string
          qa_id: number
          qa_is_non_conforming: boolean
          qa_quantity_defective: number
          qa_rep_date: string
          qa_rep_person_id: number
        }
        Insert: {
          ncr_id: number
          ncr_process_applicable_id: number
          qa_defect_desc: string
          qa_id?: never
          qa_is_non_conforming: boolean
          qa_quantity_defective: number
          qa_rep_date: string
          qa_rep_person_id: number
        }
        Update: {
          ncr_id?: number
          ncr_process_applicable_id?: number
          qa_defect_desc?: string
          qa_id?: never
          qa_is_non_conforming?: boolean
          qa_quantity_defective?: number
          qa_rep_date?: string
          qa_rep_person_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "qa_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: true
            referencedRelation: "ncr"
            referencedColumns: ["ncr_id"]
          },
          {
            foreignKeyName: "qa_ncr_id_fkey"
            columns: ["ncr_id"]
            isOneToOne: true
            referencedRelation: "ncr_list"
            referencedColumns: ["ncr_id"]
          },
          {
            foreignKeyName: "qa_ncr_process_applicable_id_fkey"
            columns: ["ncr_process_applicable_id"]
            isOneToOne: false
            referencedRelation: "ncr_process_applicable"
            referencedColumns: ["ncr_process_applicable_id"]
          },
          {
            foreignKeyName: "qa_qa_rep_person_id_fkey"
            columns: ["qa_rep_person_id"]
            isOneToOne: false
            referencedRelation: "person"
            referencedColumns: ["person_id"]
          },
        ]
      }
      role: {
        Row: {
          role_desc: string | null
          role_id: number
          role_name: string
        }
        Insert: {
          role_desc?: string | null
          role_id?: never
          role_name: string
        }
        Update: {
          role_desc?: string | null
          role_id?: never
          role_name?: string
        }
        Relationships: []
      }
      sales_order: {
        Row: {
          item_sap_number: string | null
          sales_order_date: string | null
          sales_order_id: number
          sales_order_number: string
        }
        Insert: {
          item_sap_number?: string | null
          sales_order_date?: string | null
          sales_order_id?: never
          sales_order_number: string
        }
        Update: {
          item_sap_number?: string | null
          sales_order_date?: string | null
          sales_order_id?: never
          sales_order_number?: string
        }
        Relationships: []
      }
      so_line_item: {
        Row: {
          item_id: number
          sales_order_id: number
          so_line_item_id: number
          so_line_item_quantity_ordered: number
          so_line_item_unit_price: number | null
        }
        Insert: {
          item_id: number
          sales_order_id: number
          so_line_item_id?: never
          so_line_item_quantity_ordered: number
          so_line_item_unit_price?: number | null
        }
        Update: {
          item_id?: number
          sales_order_id?: number
          so_line_item_id?: never
          so_line_item_quantity_ordered?: number
          so_line_item_unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "so_line_item_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item"
            referencedColumns: ["item_id"]
          },
          {
            foreignKeyName: "so_line_item_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_order"
            referencedColumns: ["sales_order_id"]
          },
        ]
      }
      supplier: {
        Row: {
          supplier_id: number
          supplier_name: string
        }
        Insert: {
          supplier_id?: never
          supplier_name: string
        }
        Update: {
          supplier_id?: never
          supplier_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      ncr_list: {
        Row: {
          defect_description: string | null
          disposition_label: string | null
          has_engineering: boolean | null
          has_purchasing: boolean | null
          is_archived: boolean | null
          is_draft: boolean | null
          item_name: string | null
          ncr_closed_at: string | null
          ncr_created_at: string | null
          ncr_draft_data: string | null
          ncr_draft_step: string | null
          ncr_id: number | null
          ncr_is_reinspectable: boolean | null
          ncr_number: string | null
          ncr_status_id: number | null
          process_label: string | null
          purchase_order_number: string | null
          quantity_defective: number | null
          quantity_ordered: number | null
          sales_order_number: string | null
          status_label: string | null
          supplier_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ncr_ncr_status_id_fkey"
            columns: ["ncr_status_id"]
            isOneToOne: false
            referencedRelation: "ncr_status"
            referencedColumns: ["ncr_status_id"]
          },
        ]
      }
    }
    Functions: {
      next_ncr_number: { Args: never; Returns: string }
      restore_ncr: {
        Args: { p_ncr_id: number; p_person_id: number; p_status_id: number }
        Returns: undefined
      }
      save_ncr_draft: { Args: { p: Json }; Returns: Json }
      submit_ncr: { Args: { p: Json }; Returns: Json }
      update_ncr: { Args: { p: Json }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
