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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      comments: {
        Row: {
          body: string
          created_at: string
          family_id: string
          id: string
          person_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          family_id: string
          id?: string
          person_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          family_id?: string
          id?: string
          person_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_person_id_family_id_fkey"
            columns: ["person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      confirmations: {
        Row: {
          created_at: string
          id: string
          relationship_id: string
          type: Database["public"]["Enums"]["confirmation_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          relationship_id: string
          type: Database["public"]["Enums"]["confirmation_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relationship_id?: string
          type?: Database["public"]["Enums"]["confirmation_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmations_relationship_id_fkey"
            columns: ["relationship_id"]
            isOneToOne: false
            referencedRelation: "relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissed_suggestions: {
        Row: {
          created_at: string
          dismissed_by: string | null
          family_id: string
          key: string
        }
        Insert: {
          created_at?: string
          dismissed_by?: string | null
          family_id: string
          key: string
        }
        Update: {
          created_at?: string
          dismissed_by?: string | null
          family_id?: string
          key?: string
        }
        Relationships: [
          {
            foreignKeyName: "dismissed_suggestions_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dismissed_suggestions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      edits: {
        Row: {
          created_at: string
          entity: Database["public"]["Enums"]["audit_entity"]
          entity_id: string
          family_id: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity: Database["public"]["Enums"]["audit_entity"]
          entity_id: string
          family_id: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity?: Database["public"]["Enums"]["audit_entity"]
          entity_id?: string
          family_id?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edits_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          family_id: string
          id: string
          max_uses: number | null
          revoked: boolean
          use_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          family_id: string
          id?: string
          max_uses?: number | null
          revoked?: boolean
          use_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          family_id?: string
          id?: string
          max_uses?: number | null
          revoked?: boolean
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          family_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          family_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          family_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          account_user_id: string | null
          added_by: string | null
          birth_date: string | null
          birth_year: number | null
          created_at: string
          death_date: string | null
          death_year: number | null
          details: Json
          family_id: string
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          life_status: Database["public"]["Enums"]["life_status"] | null
          name: string
          notes: string | null
          photo_path: string | null
          updated_at: string
          voice_name_path: string | null
        }
        Insert: {
          account_user_id?: string | null
          added_by?: string | null
          birth_date?: string | null
          birth_year?: number | null
          created_at?: string
          death_date?: string | null
          death_year?: number | null
          details?: Json
          family_id: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          life_status?: Database["public"]["Enums"]["life_status"] | null
          name: string
          notes?: string | null
          photo_path?: string | null
          updated_at?: string
          voice_name_path?: string | null
        }
        Update: {
          account_user_id?: string | null
          added_by?: string | null
          birth_date?: string | null
          birth_year?: number | null
          created_at?: string
          death_date?: string | null
          death_year?: number | null
          details?: Json
          family_id?: string
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          life_status?: Database["public"]["Enums"]["life_status"] | null
          name?: string
          notes?: string | null
          photo_path?: string | null
          updated_at?: string
          voice_name_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_account_user_id_fkey"
            columns: ["account_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      person_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          expires_at: string
          family_id: string
          id: string
          invited_by: string | null
          person_id: string
          revoked: boolean
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at: string
          family_id: string
          id?: string
          invited_by?: string | null
          person_id: string
          revoked?: boolean
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          family_id?: string
          id?: string
          invited_by?: string | null
          person_id?: string
          revoked?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_invites_person_id_family_id_fkey"
            columns: ["person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      photo_tags: {
        Row: {
          person_id: string
          photo_id: string
        }
        Insert: {
          person_id: string
          photo_id: string
        }
        Update: {
          person_id?: string
          photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_tags_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_tags_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          added_by: string | null
          caption: string | null
          created_at: string
          family_id: string
          id: string
          person_id: string
          storage_path: string
        }
        Insert: {
          added_by?: string | null
          caption?: string | null
          created_at?: string
          family_id: string
          id?: string
          person_id: string
          storage_path: string
        }
        Update: {
          added_by?: string | null
          caption?: string | null
          created_at?: string
          family_id?: string
          id?: string
          person_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_person_id_family_id_fkey"
            columns: ["person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relationships: {
        Row: {
          added_by: string | null
          created_at: string
          family_id: string
          from_person_id: string
          id: string
          kind: Database["public"]["Enums"]["relation_kind"] | null
          to_person_id: string
          type: Database["public"]["Enums"]["relation_type"]
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          family_id: string
          from_person_id: string
          id?: string
          kind?: Database["public"]["Enums"]["relation_kind"] | null
          to_person_id: string
          type: Database["public"]["Enums"]["relation_type"]
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          family_id?: string
          from_person_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["relation_kind"] | null
          to_person_id?: string
          type?: Database["public"]["Enums"]["relation_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relationships_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relationships_from_person_id_family_id_fkey"
            columns: ["from_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
          {
            foreignKeyName: "relationships_to_person_id_family_id_fkey"
            columns: ["to_person_id", "family_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id", "family_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_code: string }; Returns: string }
      accept_person_invite: {
        Args: {
          p_birth_date?: string
          p_current_city?: string
          p_name: string
          p_token: string
        }
        Returns: string
      }
      add_children: {
        Args: { p_children: Json; p_family_id: string; p_parent_ids: string[] }
        Returns: string[]
      }
      claim_person: { Args: { p_person_id: string }; Returns: undefined }
      create_family: { Args: { p_name: string }; Returns: string }
      create_person_invite: {
        Args: { p_days?: number; p_person_id: string }
        Returns: string
      }
      is_family_creator: { Args: { p_family_id: string }; Returns: boolean }
      is_family_member: { Args: { p_family_id: string }; Returns: boolean }
      peek_invite: {
        Args: { p_code: string }
        Returns: {
          family_id: string
          family_name: string
          member_count: number
        }[]
      }
      peek_person_invite: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          family_name: string
          invited_by_name: string
          person_name: string
        }[]
      }
      remove_member: {
        Args: { p_family_id: string; p_user_id: string }
        Returns: undefined
      }
      set_reaction: {
        Args: {
          p_relationship_id: string
          p_type: Database["public"]["Enums"]["confirmation_type"]
        }
        Returns: undefined
      }
      shares_family_with: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      audit_entity: "person" | "relationship"
      confirmation_type: "confirm" | "dispute"
      gender: "female" | "male" | "other"
      life_status: "living" | "deceased"
      relation_kind:
        | "biological"
        | "adoptive"
        | "step"
        | "foster"
        | "married"
        | "partner"
        | "engaged"
        | "former"
        | "full"
        | "half"
      relation_type: "parent_of" | "spouse_of" | "sibling_of"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_entity: ["person", "relationship"],
      confirmation_type: ["confirm", "dispute"],
      gender: ["female", "male", "other"],
      life_status: ["living", "deceased"],
      relation_kind: [
        "biological",
        "adoptive",
        "step",
        "foster",
        "married",
        "partner",
        "engaged",
        "former",
        "full",
        "half",
      ],
      relation_type: ["parent_of", "spouse_of", "sibling_of"],
    },
  },
} as const
