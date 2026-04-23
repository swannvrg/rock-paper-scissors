"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    setLoading(true);
    setError("");

    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    }
    setLoading(false);
  }
  async function handleDemo() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: "demo@demo.fr",
      password: "demo1234",
    });
    if (error) setError(error.message);
    else router.push("/");
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-md border border-gray-800">
        <h1 className="text-3xl font-black text-white text-center mb-2">
          ✊🖐️✌️
        </h1>
        <h2 className="text-xl font-bold text-white text-center mb-6">
          {isRegister ? "Créer un compte" : "Connexion"}
        </h2>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-cyan-500 outline-none"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-cyan-500 outline-none"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? "..." : isRegister ? "Créer le compte" : "Se connecter"}
          </button>

          <button
            onClick={() => setIsRegister(!isRegister)}
            className="w-full text-gray-400 hover:text-white text-sm transition"
          >
            {isRegister ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"}
          </button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs text-gray-500">
              <span className="bg-gray-900 px-2">ou</span>
            </div>
          </div>

          <button
            onClick={handleDemo}
            disabled={loading}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Jouer avec le compte démo
          </button>
        </div>
      </div>
    </div>
  );
}