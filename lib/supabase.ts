import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Game = {
  id: string;
  user_id: string;
  player_score: number;
  ai_score: number;
  winner: "player" | "ai";
  rounds: { player: string; ai: string; result: string }[];
  player_moves: { rock: number; paper: number; scissors: number };
  created_at: string;
};