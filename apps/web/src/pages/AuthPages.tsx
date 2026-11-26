import { useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <p className="auth-note">A guest can download 5 books. A signed-in reader can download 10.</p>
      {children}
    </div>
  );
}

function CodeStep({ email, password }: { email: string; password: string }) {
  const { confirm, sendCode } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  return (
    <AuthFrame>
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
      <p className="muted">Enter the code sent to {email}. It expires in 10 minutes.</p>
      <label className="field">
        <span>Code</span>
        <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" aria-label="Code" required />
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
    </form>
    </AuthFrame>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;
  if (needsCode) return <CodeStep email={email} password={password} />;

  return (
    <AuthFrame>
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
      <p className="muted">Save books to My Library and Favorites.</p>
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
      <p className="muted class-signin">
        <span>Class sign-in</span>
        Reader: reader@elibrary.local / Reader123!<br />
        Admin: admin@elibrary.local / Admin123!
      </p>
    </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;
  if (pending) return <CodeStep email={email} password={password} />;

  return (
    <AuthFrame>
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
      <p className="muted">Use an email you can open. The library sends a 6-digit code.</p>
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
      <p className="muted">Use at least 8 characters.</p>
      {error && <p className="error">{error}</p>}
      <button className="solid" type="submit">Create account</button>
      <Link className="textish" to="/login">Sign in</Link>
    </form>
    </AuthFrame>
  );
}
