import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("reader@elibrary.local");
  const [password, setPassword] = useState("Reader123!");
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  return (
    <form className="form-card" onSubmit={async (event) => {
      event.preventDefault();
      setError("");
      try {
        await login(email, password);
        navigate("/");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not sign in.");
      }
    }}>
      <h1>Sign in</h1>
      <p className="muted">Reader: reader@elibrary.local / Reader123! · Admin: admin@elibrary.local / Admin123!</p>
      <label className="field">
        <span>Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" aria-label="Email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" aria-label="Password" required />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="solid" type="submit">Sign in</button>
      <Link className="textish" to="/register">Create an account</Link>
    </form>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  return (
    <form className="form-card" onSubmit={async (event) => {
      event.preventDefault();
      setError("");
      try {
        await register(name, email, password);
        navigate("/");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not create the account.");
      }
    }}>
      <h1>Create an account</h1>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Name" required />
      </label>
      <label className="field">
        <span>Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" aria-label="Email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" aria-label="Password" required />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="solid" type="submit">Create account</button>
      <Link className="textish" to="/login">Sign in</Link>
    </form>
  );
}
