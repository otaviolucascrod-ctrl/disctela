import { useState, type FormEvent } from "react";
import { useRoom } from "../context/RoomContext";

export function LoginScreen() {
  const { join, joining } = useRoom();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 24) {
      setError("O nome deve ter entre 2 e 24 caracteres.");
      return;
    }
    setError(null);
    const result = await join(trimmed);
    if (!result.ok) {
      setError("Não foi possível entrar. Tente novamente.");
    }
  };

  return (
    <div className="login-screen">
      <div className="login-glow" aria-hidden="true" />
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-mark">
          <span className="login-mark-dot" />
          Screen
        </div>
        <h1>Compartilhar Tela</h1>
        <p className="login-sub">Entre para compartilhar ou assistir uma tela.</p>

        <label className="field-label" htmlFor="name-input">
          Seu nome
        </label>
        <input
          id="name-input"
          className="text-input"
          type="text"
          placeholder="Como podemos te chamar?"
          value={name}
          maxLength={24}
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />

        {error && <p className="login-error">{error}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={joining}>
          {joining ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
