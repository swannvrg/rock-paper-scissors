"use client";

import { useEffect, useState } from "react";
import { supabase, Game } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const EMOJI: Record<string, string> = { rock: "✊", paper: "🖐️", scissors: "✌️" };

export default function Profile() {
  const [games, setGames] = useState<Game[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("games")
        .select("*")
        .order("created_at", { ascending: true });

      setGames(data ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white text-xl">Chargement...</p>
    </div>
  );

  // Stats globales
  const totalGames = games.length;
  const wins = games.filter(g => g.winner === "player").length;
  const losses = games.filter(g => g.winner === "ai").length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  // Geste le plus joué
  const totalMoves = { rock: 0, paper: 0, scissors: 0 };
  games.forEach(g => {
    totalMoves.rock += g.player_moves.rock ?? 0;
    totalMoves.paper += g.player_moves.paper ?? 0;
    totalMoves.scissors += g.player_moves.scissors ?? 0;
  });
  const favGesture = Object.entries(totalMoves).sort((a, b) => b[1] - a[1])[0][0];
  const totalMovesCount = totalMoves.rock + totalMoves.paper + totalMoves.scissors;

  // Graphique d'évolution winrate
  let cumWins = 0;
  const chartData = games.map((g, i) => {
    if (g.winner === "player") cumWins++;
    return {
      game: i + 1,
      winRate: Math.round((cumWins / (i + 1)) * 100),
    };
  });

  // Historique récent
  const recent = [...games].reverse().slice(0, 5);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black">Mon Profil</h1>
            <p className="text-gray-400 text-sm mt-1">{email}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.push("/")}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 py-2 rounded-xl transition text-sm">
              Jouer
            </button>
            <button onClick={handleLogout}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl transition text-sm">
              Déconnexion
            </button>
          </div>
        </div>

        {/* Stats globales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Parties", value: totalGames, color: "text-white" },
            { label: "Victoires", value: wins, color: "text-green-400" },
            { label: "Défaites", value: losses, color: "text-red-400" },
            { label: "Win Rate", value: `${winRate}%`, color: "text-cyan-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-900 rounded-2xl p-4 border border-gray-800 text-center">
              <p className={`text-3xl font-black ${color}`}>{value}</p>
              <p className="text-gray-400 text-sm mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Geste favori */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
          <h2 className="text-lg font-bold mb-4">Tes gestes</h2>
          <div className="flex gap-6 items-center">
            {Object.entries(totalMoves).map(([gesture, count]) => (
              <div key={gesture} className="flex-1 text-center">
                <div className="text-4xl mb-2">{EMOJI[gesture]}</div>
                <div className="text-xl font-bold">{totalMovesCount > 0 ? Math.round((count / totalMovesCount) * 100) : 0}%</div>
                <div className="text-gray-400 text-sm capitalize">{gesture}</div>
                {gesture === favGesture && (
                  <div className="text-xs text-cyan-400 mt-1">⭐ Favori</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Graphique évolution */}
        {chartData.length > 1 && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
            <h2 className="text-lg font-bold mb-4">Évolution du win rate</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="game" stroke="#9ca3af" fontSize={12} label={{ value: "Parties", position: "insideBottom", offset: -2, fill: "#9ca3af" }} />
                <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${v}%`} contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="winRate" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Historique récent */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h2 className="text-lg font-bold mb-4">Dernières parties</h2>
          {recent.length === 0 ? (
            <p className="text-gray-400">Aucune partie jouée pour l'instant.</p>
          ) : (
            <div className="space-y-3">
              {recent.map((g) => (
                <div key={g.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`font-bold text-sm px-2 py-1 rounded-lg ${g.winner === "player" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {g.winner === "player" ? "WIN" : "LOSE"}
                    </span>
                    <span className="text-gray-300 text-sm">{g.player_score} - {g.ai_score}</span>
                  </div>
                  <div className="flex gap-2 text-sm text-gray-400">
                    <span>{EMOJI[Object.entries(g.player_moves).sort((a,b) => b[1]-a[1])[0][0]]}</span>
                    <span>{new Date(g.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}