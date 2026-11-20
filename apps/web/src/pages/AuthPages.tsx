import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function LoginPage() {
  const { user, login, confirm, sendCode } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("reader@elibrary.local");
  const [password, setPassword] = useState("Reader123!");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  if (needsCode) {
    return (
      <form className="form-card" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        try {
          await confirm(email, code);
          navigate("/");
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Could not confirm the code.");
        }
      }}>
        <h1>Enter the code</h1>
        <p className="muted">We sent a 6-digit code to {email}.</p>
        <label className="field">
          <span>Code</span>
          <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" aria-label="Code" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="solid" type="submit">Confirm</button>
        <button className="textish" type="button" onClick={async () => {
          setError("");
          try {
            await sendCode(email, password);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not send a new code.");
          }
        }}>Send a new code</button>
        <Link className="textish" to="/register">Create an account</Link>
      </form>
    );
  }

  return (
    <form className="form-card" onSubmit={async (event) => {
      event.preventDefault();
      setError("");
      try {
        await login(email, password);
        navigate("/");
      } catch (reason) {
        const coded = reason as Error & { code?: string };
        if (coded.code === "unconfirmed") setNeedsCode(true);
        setError(reason instanceof Error ? reason.message : "Could not sign in.");
      }
    }}>
      <h1>Sign in</h1>
      <p className="muted">Reader: reader@elibrary.local / Reader123!<br />Admin: admin@elibrary.local / Admin123!</p>
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
  const { user, register, confirm, sendCode } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  if (pending) {
    return (
      <form className="form-card" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        try {
          await confirm(email, code);
          navigate("/");
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "Could not confirm the code.");
        }
      }}>
        <h1>Enter the code</h1>
        <p className="muted">We sent a 6-digit code to {email}.</p>
        <label className="field">
          <span>Code</span>
          <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" aria-label="Code" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="solid" type="submit">Confirm</button>
        <button className="textish" type="button" onClick={async () => {
          setError("");
          try {
            await sendCode(email, password);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not send a new code.");
          }
        }}>Send a new code</button>
        <Link className="textish" to="/login">Sign in</Link>
      </form>
    );
  }

  return (
    <form className="form-card" onSubmit={async (event) => {
      event.preventDefault();
      setError("");
      try {
        const result = await register(name, email, password);
        if (result.pending) {
          setPending(true);
          return;
        }
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
