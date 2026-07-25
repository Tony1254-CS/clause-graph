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
      backtest_cases: {
        Row: {
          case_date: string
          company: string
          created_at: string
          fallback: Json
          fine_usd: number
          id: string
          position: number
          reconstructed_clauses: Json
          reconstructed_prompt: string
          regulation: string
          source: string
          summary: string
        }
        Insert: {
          case_date: string
          company: string
          created_at?: string
          fallback: Json
          fine_usd: number
          id: string
          position?: number
          reconstructed_clauses: Json
          reconstructed_prompt: string
          regulation: string
          source: string
          summary: string
        }
        Update: {
          case_date?: string
          company?: string
          created_at?: string
          fallback?: Json
          fine_usd?: number
          id?: string
          position?: number
          reconstructed_clauses?: Json
          reconstructed_prompt?: string
          regulation?: string
          source?: string
          summary?: string
        }
        Relationships: []
      }
      clauses: {
        Row: {
          confidence: number | null
          contract_id: string
          created_at: string
          id: string
          linked_regs: string[]
          position: number
          text: string
        }
        Insert: {
          confidence?: number | null
          contract_id: string
          created_at?: string
          id?: string
          linked_regs?: string[]
          position?: number
          text: string
        }
        Update: {
          confidence?: number | null
          contract_id?: string
          created_at?: string
          id?: string
          linked_regs?: string[]
          position?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "clauses_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_artifacts: {
        Row: {
          audit_script: Json
          created_at: string
          created_by: string | null
          gap: string
          id: string
          org_id: string
          regulation_id: string | null
          remediation: Json
          runbook: string | null
          simulation_run_id: string | null
          stack: string
          test_cases: string[]
        }
        Insert: {
          audit_script: Json
          created_at?: string
          created_by?: string | null
          gap: string
          id?: string
          org_id: string
          regulation_id?: string | null
          remediation: Json
          runbook?: string | null
          simulation_run_id?: string | null
          stack: string
          test_cases?: string[]
        }
        Update: {
          audit_script?: Json
          created_at?: string
          created_by?: string | null
          gap?: string
          id?: string
          org_id?: string
          regulation_id?: string | null
          remediation?: Json
          runbook?: string | null
          simulation_run_id?: string | null
          stack?: string
          test_cases?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "compliance_artifacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_artifacts_simulation_run_id_fkey"
            columns: ["simulation_run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          counterparty: string
          created_at: string
          extraction_error: string | null
          extraction_status: string
          id: string
          is_sample: boolean
          name: string
          org_id: string
          source_file_url: string | null
          uploaded_by: string | null
          value: number
        }
        Insert: {
          counterparty: string
          created_at?: string
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          is_sample?: boolean
          name: string
          org_id: string
          source_file_url?: string | null
          uploaded_by?: string | null
          value?: number
        }
        Update: {
          counterparty?: string
          created_at?: string
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          is_sample?: boolean
          name?: string
          org_id?: string
          source_file_url?: string | null
          uploaded_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          deleted_at: string | null
          deletion_requested_by: string | null
          deletion_scheduled_at: string | null
          id: string
          name: string
          paddle_customer_id: string | null
          plan: string
          plan_renews_at: string | null
          plan_status: string
          stripe_customer_id: string | null
          trial_ends_at: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deletion_requested_by?: string | null
          deletion_scheduled_at?: string | null
          id?: string
          name: string
          paddle_customer_id?: string | null
          plan?: string
          plan_renews_at?: string | null
          plan_status?: string
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deletion_requested_by?: string | null
          deletion_scheduled_at?: string | null
          id?: string
          name?: string
          paddle_customer_id?: string | null
          plan?: string
          plan_renews_at?: string | null
          plan_status?: string
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      paddle_events: {
        Row: {
          event_id: string
          event_type: string
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          received_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          org_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          org_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      regulation_amendments: {
        Row: {
          amended_on: string
          created_at: string
          direction: string
          id: string
          regulation_id: string
          summary: string
        }
        Insert: {
          amended_on: string
          created_at?: string
          direction: string
          id?: string
          regulation_id: string
          summary: string
        }
        Update: {
          amended_on?: string
          created_at?: string
          direction?: string
          id?: string
          regulation_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulation_amendments_regulation_id_fkey"
            columns: ["regulation_id"]
            isOneToOne: false
            referencedRelation: "regulations"
            referencedColumns: ["id"]
          },
        ]
      }
      regulations: {
        Row: {
          created_at: string
          id: string
          jurisdiction: string
          news_signal_boost: number
          obligations: Json
          org_id: string | null
          summary: string
          title: string
        }
        Insert: {
          created_at?: string
          id: string
          jurisdiction: string
          news_signal_boost?: number
          obligations?: Json
          org_id?: string | null
          summary: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          jurisdiction?: string
          news_signal_boost?: number
          obligations?: Json
          org_id?: string | null
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "regulations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_clauses: {
        Row: {
          id: string
          linked_regs: string[]
          position: number
          sample_contract_id: string
          text: string
        }
        Insert: {
          id: string
          linked_regs?: string[]
          position?: number
          sample_contract_id: string
          text: string
        }
        Update: {
          id?: string
          linked_regs?: string[]
          position?: number
          sample_contract_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_clauses_sample_contract_id_fkey"
            columns: ["sample_contract_id"]
            isOneToOne: false
            referencedRelation: "sample_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_contracts: {
        Row: {
          counterparty: string
          id: string
          name: string
          position: number
          value: number
        }
        Insert: {
          counterparty: string
          id: string
          name: string
          position?: number
          value: number
        }
        Update: {
          counterparty?: string
          id?: string
          name?: string
          position?: number
          value?: number
        }
        Relationships: []
      }
      simulation_runs: {
        Row: {
          created_at: string
          id: string
          input_regulation_text: string
          org_id: string
          result_json: Json
          run_type: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          input_regulation_text: string
          org_id: string
          result_json: Json
          run_type?: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          input_regulation_text?: string
          org_id?: string
          result_json?: Json
          run_type?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_runs_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          org_id: string | null
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          org_id?: string | null
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          org_id?: string | null
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_chain_edges: {
        Row: {
          contract_name: string
          contract_value: number
          created_at: string
          depends_on_regs: string[]
          from_node_id: string
          id: string
          key_clauses: string[]
          org_id: string
          to_node_id: string
        }
        Insert: {
          contract_name: string
          contract_value?: number
          created_at?: string
          depends_on_regs?: string[]
          from_node_id: string
          id?: string
          key_clauses?: string[]
          org_id: string
          to_node_id: string
        }
        Update: {
          contract_name?: string
          contract_value?: number
          created_at?: string
          depends_on_regs?: string[]
          from_node_id?: string
          id?: string
          key_clauses?: string[]
          org_id?: string
          to_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_chain_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "supply_chain_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_chain_edges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_chain_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "supply_chain_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_chain_nodes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          jurisdiction: string | null
          name: string
          org_id: string
          role: string
          tier: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          jurisdiction?: string | null
          name: string
          org_id: string
          role: string
          tier?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          jurisdiction?: string | null
          name?: string
          org_id?: string
          role?: string
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "supply_chain_nodes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_within_quota: {
        Args: { _action: string; _org: string }
        Returns: undefined
      }
      cancel_workspace_deletion: {
        Args: { _by: string; _org: string }
        Returns: undefined
      }
      current_org_id: { Args: never; Returns: string }
      get_org_usage: {
        Args: { _org: string }
        Returns: {
          contracts: number
          members: number
          simulations: number
        }[]
      }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      request_workspace_deletion: {
        Args: { _by: string; _org: string }
        Returns: string
      }
      resolve_org_plan: { Args: { _org: string }; Returns: string }
      seed_supply_chain: { Args: { _org: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "member"
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
      app_role: ["admin", "member"],
    },
  },
} as const
