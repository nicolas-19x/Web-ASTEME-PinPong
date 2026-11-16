
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "academy_settings": {
                  Row: {
                    "banner_path": string | null,"default_rules": NonNullable<Json>,"default_tiebreakers": (string)[],"id": boolean,"locale": string,"logo_path": string | null,"name": string,"portal_visibility": NonNullable<Json>,"short_name": string | null,"theme": NonNullable<Json>,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "banner_path"?: string | null,"default_rules"?: NonNullable<Json>,"default_tiebreakers"?: (string)[],"id"?: boolean,"locale"?: string,"logo_path"?: string | null,"name"?: string,"portal_visibility"?: NonNullable<Json>,"short_name"?: string | null,"theme"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "banner_path"?: string | null,"default_rules"?: NonNullable<Json>,"default_tiebreakers"?: (string)[],"id"?: boolean,"locale"?: string,"logo_path"?: string | null,"name"?: string,"portal_visibility"?: NonNullable<Json>,"short_name"?: string | null,"theme"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"achievements": {
                  Row: {
                    "description": string | null,"icon": string | null,"id": string,"kind": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"icon"?: string | null,"id"?: string,"kind"?: string,"name": string
                  }
                  Update: {
                    "description"?: string | null,"icon"?: string | null,"id"?: string,"kind"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"activity_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"entity": string,"entity_id": string | null,"id": string,"summary": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: string,"summary": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: string,"summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_logs_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcement_reads": {
                  Row: {
                    "announcement_id": string,"profile_id": string,"read_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement_id": string,"profile_id": string,"read_at"?: string
                  }
                  Update: {
                    "announcement_id"?: string,"profile_id"?: string,"read_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_reads_announcement_id_fkey"
      columns: ["announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_reads_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "author_id": string | null,"body": string,"category_id": string | null,"created_at": string,"group_id": string | null,"id": string,"kind": string,"published": boolean,"published_at": string | null,"scope": string,"title": string,"to_guardians": boolean,"to_players": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"category_id"?: string | null,"created_at"?: string,"group_id"?: string | null,"id"?: string,"kind"?: string,"published"?: boolean,"published_at"?: string | null,"scope"?: string,"title": string,"to_guardians"?: boolean,"to_players"?: boolean
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"category_id"?: string | null,"created_at"?: string,"group_id"?: string | null,"id"?: string,"kind"?: string,"published"?: boolean,"published_at"?: string | null,"scope"?: string,"title"?: string,"to_guardians"?: boolean,"to_players"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "training_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance": {
                  Row: {
                    "group_id": string,"id": string,"note": string | null,"on_date": string,"player_id": string,"recorded_at": string,"recorded_by": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"note"?: string | null,"on_date": string,"player_id": string,"recorded_at"?: string,"recorded_by"?: string | null,"status": string
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"note"?: string | null,"on_date"?: string,"player_id"?: string,"recorded_at"?: string,"recorded_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "training_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "active": boolean,"created_at": string,"description": string | null,"id": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"competition_participants": {
                  Row: {
                    "called_up": boolean,"category_label": string | null,"competition_id": string,"final_position": number | null,"id": string,"matches_lost": number | null,"matches_won": number | null,"medal": string | null,"notes": string | null,"player_id": string,"recognition": string | null,"registered": boolean,"sets_lost": number | null,"sets_won": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "called_up"?: boolean,"category_label"?: string | null,"competition_id": string,"final_position"?: number | null,"id"?: string,"matches_lost"?: number | null,"matches_won"?: number | null,"medal"?: string | null,"notes"?: string | null,"player_id": string,"recognition"?: string | null,"registered"?: boolean,"sets_lost"?: number | null,"sets_won"?: number | null
                  }
                  Update: {
                    "called_up"?: boolean,"category_label"?: string | null,"competition_id"?: string,"final_position"?: number | null,"id"?: string,"matches_lost"?: number | null,"matches_won"?: number | null,"medal"?: string | null,"notes"?: string | null,"player_id"?: string,"recognition"?: string | null,"registered"?: boolean,"sets_lost"?: number | null,"sets_won"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "competition_participants_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competition_participants_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"competition_photos": {
                  Row: {
                    "authorized": boolean,"caption": string | null,"competition_id": string,"created_at": string,"id": string,"storage_path": string,"uploaded_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "authorized"?: boolean,"caption"?: string | null,"competition_id": string,"created_at"?: string,"id"?: string,"storage_path": string,"uploaded_by"?: string | null
                  }
                  Update: {
                    "authorized"?: boolean,"caption"?: string | null,"competition_id"?: string,"created_at"?: string,"id"?: string,"storage_path"?: string,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "competition_photos_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competition_photos_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"competitions": {
                  Row: {
                    "categories": string | null,"created_at": string,"end_date": string | null,"id": string,"location": string | null,"name": string,"notes": string | null,"organizer": string | null,"scope": string,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "categories"?: string | null,"created_at"?: string,"end_date"?: string | null,"id"?: string,"location"?: string | null,"name": string,"notes"?: string | null,"organizer"?: string | null,"scope"?: string,"start_date": string
                  }
                  Update: {
                    "categories"?: string | null,"created_at"?: string,"end_date"?: string | null,"id"?: string,"location"?: string | null,"name"?: string,"notes"?: string | null,"organizer"?: string | null,"scope"?: string,"start_date"?: string
                  }
                  Relationships: [
                    
                  ]
                },"control_results": {
                  Row: {
                    "created_at": string,"id": string,"measured_on": string,"notes": string | null,"player_id": string,"shared": boolean,"test_id": string,"value": number | null,"value_text": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"measured_on"?: string,"notes"?: string | null,"player_id": string,"shared"?: boolean,"test_id": string,"value"?: number | null,"value_text"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"measured_on"?: string,"notes"?: string | null,"player_id"?: string,"shared"?: boolean,"test_id"?: string,"value"?: number | null,"value_text"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "control_results_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "control_results_test_id_fkey"
      columns: ["test_id"]
isOneToOne: false
      referencedRelation: "control_tests"
      referencedColumns: ["id"]
    }
                  ]
                },"control_tests": {
                  Row: {
                    "active": boolean,"higher_is_better": boolean,"id": string,"name": string,"unit": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"higher_is_better"?: boolean,"id"?: string,"name": string,"unit"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"higher_is_better"?: boolean,"id"?: string,"name"?: string,"unit"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"development_goals": {
                  Row: {
                    "description": string,"id": string,"kind": string,"plan_id": string,"player_id": string,"shared": boolean,"sort_order": number,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"id"?: string,"kind": string,"plan_id": string,"player_id": string,"shared"?: boolean,"sort_order"?: number,"status"?: string
                  }
                  Update: {
                    "description"?: string,"id"?: string,"kind"?: string,"plan_id"?: string,"player_id"?: string,"shared"?: boolean,"sort_order"?: number,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "development_goals_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "development_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "development_goals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"development_plans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_current": boolean,"player_id": string,"review_date": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_current"?: boolean,"player_id": string,"review_date"?: string | null,"version": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_current"?: boolean,"player_id"?: string,"review_date"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "development_plans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "development_plans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"evaluation_items": {
                  Row: {
                    "comment": string | null,"evaluation_id": string,"id": string,"player_id": string,"score": number | null,"skill_id": string | null,"skill_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comment"?: string | null,"evaluation_id": string,"id"?: string,"player_id": string,"score"?: number | null,"skill_id"?: string | null,"skill_name": string
                  }
                  Update: {
                    "comment"?: string | null,"evaluation_id"?: string,"id"?: string,"player_id"?: string,"score"?: number | null,"skill_id"?: string | null,"skill_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_items_evaluation_id_fkey"
      columns: ["evaluation_id"]
isOneToOne: false
      referencedRelation: "evaluations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_items_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_items_skill_id_fkey"
      columns: ["skill_id"]
isOneToOne: false
      referencedRelation: "skills"
      referencedColumns: ["id"]
    }
                  ]
                },"evaluations": {
                  Row: {
                    "conclusion": string | null,"created_at": string,"evaluated_on": string,"evaluator_id": string | null,"evaluator_name": string | null,"id": string,"player_id": string,"shared": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "conclusion"?: string | null,"created_at"?: string,"evaluated_on"?: string,"evaluator_id"?: string | null,"evaluator_name"?: string | null,"id"?: string,"player_id": string,"shared"?: boolean
                  }
                  Update: {
                    "conclusion"?: string | null,"created_at"?: string,"evaluated_on"?: string,"evaluator_id"?: string | null,"evaluator_name"?: string | null,"id"?: string,"player_id"?: string,"shared"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluations_evaluator_id_fkey"
      columns: ["evaluator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluations_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"group_memberships": {
                  Row: {
                    "end_date": string | null,"group_id": string,"id": string,"player_id": string,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "end_date"?: string | null,"group_id": string,"id"?: string,"player_id": string,"start_date"?: string
                  }
                  Update: {
                    "end_date"?: string | null,"group_id"?: string,"id"?: string,"player_id"?: string,"start_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_memberships_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "training_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_memberships_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"group_schedules": {
                  Row: {
                    "end_time": string,"group_id": string,"id": string,"location": string | null,"start_time": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "end_time": string,"group_id": string,"id"?: string,"location"?: string | null,"start_time": string,"weekday": number
                  }
                  Update: {
                    "end_time"?: string,"group_id"?: string,"id"?: string,"location"?: string | null,"start_time"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_schedules_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "training_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"guardians": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"notes": string | null,"phone": string | null,"profile_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"profile_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"profile_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "guardians_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"levels": {
                  Row: {
                    "id": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"match_result_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"id": string,"match_id": string,"new": Json | null,"previous": Json | null,"reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: string,"match_id": string,"new"?: Json | null,"previous"?: Json | null,"reason"?: string | null
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: string,"match_id"?: string,"new"?: Json | null,"previous"?: Json | null,"reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_result_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_result_history_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    }
                  ]
                },"match_sets": {
                  Row: {
                    "id": string,"match_id": string,"points_a": number,"points_b": number,"set_no": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"match_id": string,"points_a": number,"points_b": number,"set_no": number
                  }
                  Update: {
                    "id"?: string,"match_id"?: string,"points_a"?: number,"points_b"?: number,"set_no"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_sets_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "a_source": Json | null,"b_source": Json | null,"group_id": string | null,"id": string,"is_third_place": boolean,"key": string,"label": string | null,"player_a": string | null,"player_b": string | null,"points_a": number,"points_b": number,"position": number | null,"round": number,"sets_a": number,"sets_b": number,"slot": number | null,"stage": string,"status": string,"table_no": number | null,"tournament_id": string,"updated_at": string,"walkover": boolean,"winner_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "a_source"?: Json | null,"b_source"?: Json | null,"group_id"?: string | null,"id"?: string,"is_third_place"?: boolean,"key": string,"label"?: string | null,"player_a"?: string | null,"player_b"?: string | null,"points_a"?: number,"points_b"?: number,"position"?: number | null,"round": number,"sets_a"?: number,"sets_b"?: number,"slot"?: number | null,"stage": string,"status"?: string,"table_no"?: number | null,"tournament_id": string,"updated_at"?: string,"walkover"?: boolean,"winner_id"?: string | null
                  }
                  Update: {
                    "a_source"?: Json | null,"b_source"?: Json | null,"group_id"?: string | null,"id"?: string,"is_third_place"?: boolean,"key"?: string,"label"?: string | null,"player_a"?: string | null,"player_b"?: string | null,"points_a"?: number,"points_b"?: number,"position"?: number | null,"round"?: number,"sets_a"?: number,"sets_b"?: number,"slot"?: number | null,"stage"?: string,"status"?: string,"table_no"?: number | null,"tournament_id"?: string,"updated_at"?: string,"walkover"?: boolean,"winner_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "tournament_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_player_a_fkey"
      columns: ["player_a"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_player_b_fkey"
      columns: ["player_b"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_winner_id_fkey"
      columns: ["winner_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"player_achievements": {
                  Row: {
                    "achievement_id": string | null,"awarded_on": string,"created_at": string,"created_by": string | null,"description": string | null,"id": string,"kind": string,"medal": string | null,"player_id": string,"shared": boolean,"source_id": string | null,"source_type": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievement_id"?: string | null,"awarded_on"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"kind"?: string,"medal"?: string | null,"player_id": string,"shared"?: boolean,"source_id"?: string | null,"source_type"?: string,"title": string
                  }
                  Update: {
                    "achievement_id"?: string | null,"awarded_on"?: string,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"id"?: string,"kind"?: string,"medal"?: string | null,"player_id"?: string,"shared"?: boolean,"source_id"?: string | null,"source_type"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_achievements_achievement_id_fkey"
      columns: ["achievement_id"]
isOneToOne: false
      referencedRelation: "achievements"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_achievements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_achievements_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"player_guardians": {
                  Row: {
                    "authorized": boolean,"created_at": string,"guardian_id": string,"id": string,"player_id": string,"relationship": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "authorized"?: boolean,"created_at"?: string,"guardian_id": string,"id"?: string,"player_id": string,"relationship"?: string | null
                  }
                  Update: {
                    "authorized"?: boolean,"created_at"?: string,"guardian_id"?: string,"id"?: string,"player_id"?: string,"relationship"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_guardians_guardian_id_fkey"
      columns: ["guardian_id"]
isOneToOne: false
      referencedRelation: "guardians"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_guardians_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"player_history": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"id": string,"kind": string,"new_value": string | null,"note": string | null,"old_value": string | null,"player_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: string,"kind": string,"new_value"?: string | null,"note"?: string | null,"old_value"?: string | null,"player_id": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: string,"kind"?: string,"new_value"?: string | null,"note"?: string | null,"old_value"?: string | null,"player_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_history_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_history_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "age_reported": number | null,"age_reported_on": string | null,"birth_date": string | null,"category_id": string | null,"created_at": string,"dominant_hand": string | null,"first_name": string,"id": string,"join_date": string | null,"last_names": string | null,"level_id": string | null,"photo_authorized": boolean,"photo_path": string | null,"ranking_points": number | null,"status": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "age_reported"?: number | null,"age_reported_on"?: string | null,"birth_date"?: string | null,"category_id"?: string | null,"created_at"?: string,"dominant_hand"?: string | null,"first_name": string,"id"?: string,"join_date"?: string | null,"last_names"?: string | null,"level_id"?: string | null,"photo_authorized"?: boolean,"photo_path"?: string | null,"ranking_points"?: number | null,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "age_reported"?: number | null,"age_reported_on"?: string | null,"birth_date"?: string | null,"category_id"?: string | null,"created_at"?: string,"dominant_hand"?: string | null,"first_name"?: string,"id"?: string,"join_date"?: string | null,"last_names"?: string | null,"level_id"?: string | null,"photo_authorized"?: boolean,"photo_path"?: string | null,"ranking_points"?: number | null,"status"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "players_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "players_level_id_fkey"
      columns: ["level_id"]
isOneToOne: false
      referencedRelation: "levels"
      referencedColumns: ["id"]
    }
                  ]
                },"private_notes": {
                  Row: {
                    "body": string,"created_at": string,"created_by": string | null,"entity_id": string | null,"entity_type": string,"id": string,"player_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"created_by"?: string | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"player_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"created_by"?: string | null,"entity_id"?: string | null,"entity_type"?: string,"id"?: string,"player_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "private_notes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "private_notes_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "active": boolean,"created_at": string,"full_name": string,"id": string,"role": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"full_name": string,"id": string,"role": string,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"full_name"?: string,"id"?: string,"role"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ranking_movements": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"id": string,"new_value": number | null,"old_value": number | null,"player_id": string,"reason": string,"tournament_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: string,"new_value"?: number | null,"old_value"?: number | null,"player_id": string,"reason": string,"tournament_id"?: string | null
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: string,"new_value"?: number | null,"old_value"?: number | null,"player_id"?: string,"reason"?: string,"tournament_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ranking_movements_changed_by_fkey"
      columns: ["changed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ranking_movements_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ranking_movements_tournament_fk"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"schedule_exceptions": {
                  Row: {
                    "created_at": string,"end_time": string | null,"group_id": string,"id": string,"kind": string,"location": string | null,"note": string | null,"on_date": string,"start_time": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_time"?: string | null,"group_id": string,"id"?: string,"kind": string,"location"?: string | null,"note"?: string | null,"on_date": string,"start_time"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string | null,"group_id"?: string,"id"?: string,"kind"?: string,"location"?: string | null,"note"?: string | null,"on_date"?: string,"start_time"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "schedule_exceptions_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "training_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"skills": {
                  Row: {
                    "active": boolean,"id": string,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"id"?: string,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"id"?: string,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"sport_events": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"location": string | null,"notes": string | null,"start_time": string | null,"starts_on": string,"title": string,"visible_in_portals": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"location"?: string | null,"notes"?: string | null,"start_time"?: string | null,"starts_on": string,"title": string,"visible_in_portals"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"location"?: string | null,"notes"?: string | null,"start_time"?: string | null,"starts_on"?: string,"title"?: string,"visible_in_portals"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"tournament_bracket": {
                  Row: {
                    "generated_at": string,"same_group_conflicts": number,"size": number,"tournament_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "generated_at"?: string,"same_group_conflicts"?: number,"size": number,"tournament_id": string
                  }
                  Update: {
                    "generated_at"?: string,"same_group_conflicts"?: number,"size"?: number,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_bracket_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: true
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_group_players": {
                  Row: {
                    "group_id": string,"id": string,"player_id": string,"seed_in_group": number,"tournament_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"player_id": string,"seed_in_group": number,"tournament_id": string
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"player_id"?: string,"seed_in_group"?: number,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_group_players_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "tournament_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_group_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_group_players_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_groups": {
                  Row: {
                    "id": string,"idx": number,"manual_order": (string)[] | null,"manual_order_note": string | null,"name": string,"tournament_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"idx": number,"manual_order"?: (string)[] | null,"manual_order_note"?: string | null,"name": string,"tournament_id": string
                  }
                  Update: {
                    "id"?: string,"idx"?: number,"manual_order"?: (string)[] | null,"manual_order_note"?: string | null,"name"?: string,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_groups_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_participants": {
                  Row: {
                    "final_position": number | null,"id": string,"matches_lost": number,"matches_won": number,"medal": string | null,"player_id": string,"ranking_at_entry": number | null,"seed_position": number | null,"sets_lost": number,"sets_won": number,"tournament_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "final_position"?: number | null,"id"?: string,"matches_lost"?: number,"matches_won"?: number,"medal"?: string | null,"player_id": string,"ranking_at_entry"?: number | null,"seed_position"?: number | null,"sets_lost"?: number,"sets_won"?: number,"tournament_id": string
                  }
                  Update: {
                    "final_position"?: number | null,"id"?: string,"matches_lost"?: number,"matches_won"?: number,"medal"?: string | null,"player_id"?: string,"ranking_at_entry"?: number | null,"seed_position"?: number | null,"sets_lost"?: number,"sets_won"?: number,"tournament_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_participants_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_participants_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_standings": {
                  Row: {
                    "classification_points": number,"decided_by": string | null,"group_id": string,"id": string,"lost": number,"played": number,"player_id": string,"points_against": number,"points_for": number,"position": number,"sets_against": number,"sets_for": number,"tournament_id": string,"won": number
                  }
                  ComputedFields: never
                  Insert: {
                    "classification_points"?: number,"decided_by"?: string | null,"group_id": string,"id"?: string,"lost"?: number,"played"?: number,"player_id": string,"points_against"?: number,"points_for"?: number,"position": number,"sets_against"?: number,"sets_for"?: number,"tournament_id": string,"won"?: number
                  }
                  Update: {
                    "classification_points"?: number,"decided_by"?: string | null,"group_id"?: string,"id"?: string,"lost"?: number,"played"?: number,"player_id"?: string,"points_against"?: number,"points_for"?: number,"position"?: number,"sets_against"?: number,"sets_for"?: number,"tournament_id"?: string,"won"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_standings_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "tournament_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_standings_tournament_id_fkey"
      columns: ["tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["id"]
    }
                  ]
                },"tournaments": {
                  Row: {
                    "advance_per_group": number,"category_ids": (string)[],"created_at": string,"created_by": string | null,"draw_seed": number | null,"finalized_at": string | null,"format": string,"group_count": number,"held_on": string,"id": string,"knockout_rules": Json | null,"location": string | null,"modality": string,"name": string,"notes": string | null,"rules": NonNullable<Json>,"status": string,"tables_available": number,"third_place": boolean,"tie_mode": string,"tiebreakers": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "advance_per_group"?: number,"category_ids"?: (string)[],"created_at"?: string,"created_by"?: string | null,"draw_seed"?: number | null,"finalized_at"?: string | null,"format"?: string,"group_count"?: number,"held_on": string,"id"?: string,"knockout_rules"?: Json | null,"location"?: string | null,"modality"?: string,"name": string,"notes"?: string | null,"rules"?: NonNullable<Json>,"status"?: string,"tables_available"?: number,"third_place"?: boolean,"tie_mode"?: string,"tiebreakers"?: (string)[]
                  }
                  Update: {
                    "advance_per_group"?: number,"category_ids"?: (string)[],"created_at"?: string,"created_by"?: string | null,"draw_seed"?: number | null,"finalized_at"?: string | null,"format"?: string,"group_count"?: number,"held_on"?: string,"id"?: string,"knockout_rules"?: Json | null,"location"?: string | null,"modality"?: string,"name"?: string,"notes"?: string | null,"rules"?: NonNullable<Json>,"status"?: string,"tables_available"?: number,"third_place"?: boolean,"tie_mode"?: string,"tiebreakers"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournaments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"training_groups": {
                  Row: {
                    "active": boolean,"category_id": string | null,"coach_id": string | null,"created_at": string,"id": string,"level_id": string | null,"location": string | null,"name": string,"notes": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"category_id"?: string | null,"coach_id"?: string | null,"created_at"?: string,"id"?: string,"level_id"?: string | null,"location"?: string | null,"name": string,"notes"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"category_id"?: string | null,"coach_id"?: string | null,"created_at"?: string,"id"?: string,"level_id"?: string | null,"location"?: string | null,"name"?: string,"notes"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_groups_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_groups_coach_id_fkey"
      columns: ["coach_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "training_groups_level_id_fkey"
      columns: ["level_id"]
isOneToOne: false
      referencedRelation: "levels"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "finalize_tournament":
{ Args: { "p_positions": Json,"p_tournament_id": string }; Returns: undefined
                           },
"portal_match_results":
{ Args: { "p_player_id": string }; Returns: {
              "held_on": string,"label": string,"match_id": string,"opponent_first_name": string,"round": number,"sets_against": number,"sets_for": number,"stage": string,"tournament_id": string,"tournament_name": string,"walkover": boolean,"won": boolean
            }[]
                           },
"save_match_result":
{ Args: { "p_match_id": string,"p_reason"?: string,"p_sets": Json,"p_walkover_winner"?: string }; Returns: {
              "a_source": Json | null,
"b_source": Json | null,
"group_id": string | null,
"id": string,
"is_third_place": boolean,
"key": string,
"label": string | null,
"player_a": string | null,
"player_b": string | null,
"points_a": number,
"points_b": number,
"position": number | null,
"round": number,
"sets_a": number,
"sets_b": number,
"slot": number | null,
"stage": string,
"status": string,
"table_no": number | null,
"tournament_id": string,
"updated_at": string,
"walkover": boolean,
"winner_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "matches"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
