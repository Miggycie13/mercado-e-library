import { useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

function AuthWelcome() {
  return (
    <div className="auth-welcome">
      <p className="auth-headline">Your personal public-domain reading room.</p>
      <ul className="auth-perks">
        <li>10 downloads, up from 5 for a guest</li>
        <li>Save books to My Library</li>
        <li>Keep a Favorites list</li>
      </ul>
      <p className="auth-quote">There is no Frigate like a Book.</p>
    </div>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <AuthWelcome />
      {children}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PasswordField({
  value,
  onChange,
  aside,
}: {
  value: string;
  onChange: (value: string) => void;
  aside?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span className="field-head">
        <span>Password</span>
        {aside}
      </span>
      <span className="secret">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? "text" : "password"}
          aria-label="Password"
          required
        />
        <button
          className="eye"
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          <EyeIcon />
        </button>
      </span>
    </label>
  );
}

function CodeStep({ email, password, remember = true }: { email: string; password: string; remember?: boolean }) {
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
        await confirm(email, code, remember);
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
  const [remember, setRemember] = useState(true);
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;
  if (needsCode) return <CodeStep email={email} password={password} remember={remember} />;

  return (
    <AuthFrame>
    <form className="form-card" onSubmit={async (event) => {
      event.preventDefault();
      setError("");
      try {
        await login(email, password, remember);
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
      <PasswordField
        value={password}
        onChange={setPassword}
        aside={<button className="forgot" type="button" onClick={() => document.getElementById("class-signin")?.focus()}>Forgot password?</button>}
      />
      <label className="remember">
        <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
        Remember me
      </label>
      {error && <p className="error">{error}</p>}
      <button className="solid" type="submit">Sign in</button>
      <p className="auth-switch">New to The Emerald Archive? <Link to="/register">Create an account</Link></p>
      <div className="class-signin" id="class-signin" tabIndex={-1}>
        <span>Class sign-in</span>
        <div className="class-fills">
          <button type="button" onClick={() => { setEmail("reader@elibrary.local"); setPassword("Reader123!"); }}>Fill Reader</button>
          <button type="button" onClick={() => { setEmail("admin@elibrary.local"); setPassword("Admin123!"); }}>Fill Admin</button>
        </div>
        Reader: reader@elibrary.local / Reader123!<br />
        Admin: admin@elibrary.local / Admin123!
      </div>
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
      <PasswordField value={password} onChange={setPassword} />
      <p className={password.length >= 8 ? "password-ready" : "muted"}>Use at least 8 characters.</p>
      <p className="muted">Sign up now to unlock 10 downloads.</p>
      {error && <p className="error">{error}</p>}
      <button className="solid" type="submit">Create account</button>
      <Link className="textish" to="/login">Sign in</Link>
    </form>
    </AuthFrame>
  );
}
