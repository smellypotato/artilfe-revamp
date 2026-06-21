import { useState, type FormEvent } from "react";
import { signIn } from "../services/authService";
import "../Styles/LoginPanel.css";

export function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await signIn(email.trim(), password);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "登入失敗，請稍後再試。",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main id="LoginPage">
      <section className="LoginPanel">
        <p className="Eyebrow">Artfile</p>
        <h1 id="loginTitle">庫存管理</h1>
        <p>請使用管理員提供的帳戶登入。</p>

        <form className="LoginForm" onSubmit={handleSubmit}>
          <label>
            電郵
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label>
            密碼
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <p className="LoginError">{error}</p> : null}

          <button type="submit" className="loginButton" disabled={isLoading}>
            {isLoading ? "登入中..." : "登入"}
          </button>
        </form>
      </section>
    </main>
  );
}
