/**
 * The database types the app is written against.
 *
 * These are the types `supabase gen types` produces for the schema in
 * supabase/migrations/0001_init.sql. Regenerate them after any change to the
 * schema and commit the result, so a column rename is a type error rather than
 * an undefined read at runtime:
 *
 *   npx supabase gen types typescript --linked --schema public > src/lib/database.types.ts
 *
 * For a local stack instead of the hosted project:
 *
 *   npx supabase gen types typescript --local --schema public > src/lib/database.types.ts
 *
 * The Supabase CLI is deliberately not a dependency of this repo. It is a large
 * binary that only ever runs on a developer machine, never in the app or the
 * build, so `npx` on demand is the right weight. Pin it for reproducible output:
 * `npx supabase@latest gen types ...`.
 *
 * Hand-maintained until first generated: this file was written to match
 * 0001_init.sql exactly. Run the command above once against the live project and
 * commit the diff, so what is here has been checked against the real schema
 * rather than only against the migration.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// The generator emits a type alias here. Matched rather than rewritten, so this
// file stays diffable against fresh generator output instead of drifting from it
// the first time somebody regenerates.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Database = {
  public: {
    Tables: {
      checkins: {
        Row: {
          created_at: string
          date: string
          habit_id: string
          id: string
          /**
           * Written by the `checkins_set_user_id` trigger, not by the client.
           * Absent from Insert on purpose: sending one is ignored.
           */
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          habit_id: string
          id?: string
          user_id?: never
        }
        Update: {
          created_at?: string
          date?: string
          habit_id?: string
          id?: string
          user_id?: never
        }
        Relationships: [
          {
            foreignKeyName: 'checkins_habit_id_fkey'
            columns: ['habit_id']
            isOneToOne: false
            referencedRelation: 'habits'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'checkins_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      habits: {
        Row: {
          archived: boolean
          color: 'teal' | 'blue' | 'purple' | 'yellow' | 'coral'
          created_at: string
          id: string
          monthly_goal: number
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color: 'teal' | 'blue' | 'purple' | 'yellow' | 'coral'
          created_at?: string
          id?: string
          monthly_goal: number
          name: string
          sort_order?: number
          updated_at?: string
          user_id?: never
        }
        Update: {
          archived?: boolean
          color?: 'teal' | 'blue' | 'purple' | 'yellow' | 'coral'
          created_at?: string
          id?: string
          monthly_goal?: number
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: never
        }
        Relationships: [
          {
            foreignKeyName: 'habits_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          reminder_time: string | null
          theme: 'light' | 'dark' | 'system'
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          reminder_time?: string | null
          theme?: 'light' | 'dark' | 'system'
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          reminder_time?: string | null
          theme?: 'light' | 'dark' | 'system'
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database['public']

/** Convenience aliases, so callers write `HabitRow` instead of the indexed access. */
export type Tables<PublicTableName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][PublicTableName] extends { Row: infer RowType } ? RowType : never

export type TablesInsert<PublicTableName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][PublicTableName]['Insert']

export type TablesUpdate<PublicTableName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][PublicTableName]['Update']
