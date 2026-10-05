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
      platform_settings: {
        Row: {
          fee_rate: number
          id: number
          inspection_price_cents: number
          updated_at: string
        }
        Insert: {
          fee_rate?: number
          id?: number
          inspection_price_cents?: number
          updated_at?: string
        }
        Update: {
          fee_rate?: number
          id?: number
          inspection_price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          fee_waived: boolean
          full_name: string
          id: string
          phone: string | null
          state: string | null
          suspended: boolean
        }
        Insert: {
          city?: string | null
          created_at?: string
          fee_waived?: boolean
          full_name?: string
          id: string
          phone?: string | null
          state?: string | null
          suspended?: boolean
        }
        Update: {
          city?: string | null
          created_at?: string
          fee_waived?: boolean
          full_name?: string
          id?: string
          phone?: string | null
          state?: string | null
          suspended?: boolean
        }
        Relationships: []
      }
      state_rules: {
        Row: {
          annual_sale_limit: number
          max_apr: number
          state: string
          updated_at: string
        }
        Insert: {
          annual_sale_limit: number
          max_apr: number
          state: string
          updated_at?: string
        }
        Update: {
          annual_sale_limit?: number
          max_apr?: number
          state?: string
          updated_at?: string
        }
        Relationships: []
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
      vehicles: {
        Row: {
          allowed_terms: number[]
          apr: number
          body: string | null
          city: string
          condition: string | null
          created_at: string
          description: string | null
          exterior_color: string | null
          features: string[]
          history_summary: Json
          id: string
          interior_color: string | null
          make: string
          market_high_cents: number | null
          market_low_cents: number | null
          mileage: number
          min_down_pct: number
          model: string
          photos: string[]
          price_cents: number
          seller_display_name: string
          seller_id: string | null
          seller_verified: boolean
          state: string
          status: Database["public"]["Enums"]["vehicle_status"]
          trim: string | null
          updated_at: string
          vin: string
          year: number
          zip: string | null
        }
        Insert: {
          allowed_terms?: number[]
          apr: number
          body?: string | null
          city: string
          condition?: string | null
          created_at?: string
          description?: string | null
          exterior_color?: string | null
          features?: string[]
          history_summary?: Json
          id?: string
          interior_color?: string | null
          make: string
          market_high_cents?: number | null
          market_low_cents?: number | null
          mileage?: number
          min_down_pct?: number
          model: string
          photos?: string[]
          price_cents: number
          seller_display_name?: string
          seller_id?: string | null
          seller_verified?: boolean
          state: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          trim?: string | null
          updated_at?: string
          vin: string
          year: number
          zip?: string | null
        }
        Update: {
          allowed_terms?: number[]
          apr?: number
          body?: string | null
          city?: string
          condition?: string | null
          created_at?: string
          description?: string | null
          exterior_color?: string | null
          features?: string[]
          history_summary?: Json
          id?: string
          interior_color?: string | null
          make?: string
          market_high_cents?: number | null
          market_low_cents?: number | null
          mileage?: number
          min_down_pct?: number
          model?: string
          photos?: string[]
          price_cents?: number
          seller_display_name?: string
          seller_id?: string | null
          seller_verified?: boolean
          state?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          trim?: string | null
          updated_at?: string
          vin?: string
          year?: number
          zip?: string | null
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
    }
    Enums: {
      app_role: "admin" | "seller" | "buyer"
      vehicle_status:
        | "draft"
        | "verifying"
        | "blocked"
        | "pending_review"
        | "listed"
        | "reserved"
        | "sold_active"
        | "paid_off"
        | "delisted"
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
    Enums: {
      app_role: ["admin", "seller", "buyer"],
      vehicle_status: [
        "draft",
        "verifying",
        "blocked",
        "pending_review",
        "listed",
        "reserved",
        "sold_active",
        "paid_off",
        "delisted",
      ],
    },
  },
} as const
