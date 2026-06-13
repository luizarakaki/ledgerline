/* Sign in / Sign up — two-panel layout, validated with React Hook Form. */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Icons } from "@/components/icons";
import { Logo, Spinner } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

type Mode = "signin" | "signup";
interface FormValues {
  name: string;
  email: string;
  password: string;
}

export function AuthScreen({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { name: "", email: "", password: "" } });

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
  };

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    try {
      const { user } =
        mode === "signup"
          ? await api.signUp({ name: values.name, email: values.email, password: values.password })
          : await api.signIn({ email: values.email, password: values.password });
      onAuthed(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  });

  return (
    <div className="auth-wrap">
      {/* ---- left brand panel ---- */}
      <aside className="auth-aside">
        <div className="auth-aside-top">
          <Logo size={30} />
        </div>
        <div className="auth-aside-mid">
          <h1 className="auth-headline">Consolidate two entities into one set of books.</h1>
          <ul className="auth-points">
            <li>
              <span className="ap-ic">
                <Icons.layers size={15} />
              </span>{" "}
              Parent · Subsidiary · Eliminations · Consolidated
            </li>
            <li>
              <span className="ap-ic">
                <Icons.sparkle size={15} />
              </span>{" "}
              Automatic intercompany matching
            </li>
            <li>
              <span className="ap-ic">
                <Icons.checkCircle size={15} />
              </span>{" "}
              Balance check on every run
            </li>
          </ul>
        </div>
      </aside>

      {/* ---- right form panel ---- */}
      <main className="auth-main">
        <div className="auth-card fade-in" key={mode}>
          <div className="auth-tabs">
            <button className={mode === "signin" ? "on" : ""} onClick={() => switchMode("signin")} type="button">
              Sign in
            </button>
            <button className={mode === "signup" ? "on" : ""} onClick={() => switchMode("signup")} type="button">
              Create account
            </button>
          </div>

          <h2 className="auth-title">{mode === "signin" ? "Welcome back" : "Get started"}</h2>
          <p className="auth-title-sub">
            {mode === "signin"
              ? "Sign in to your workspace."
              : "Create a workspace to run your first consolidation."}
          </p>

          <form onSubmit={onSubmit} className="auth-form" noValidate>
            {mode === "signup" && (
              <div className="field">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  placeholder="Dana Reyes"
                  autoComplete="name"
                  invalid={!!errors.name}
                  {...register("name", { required: "Please enter your name." })}
                />
                {errors.name && <span className="field-err">{errors.name.message}</span>}
              </div>
            )}
            <div className="field">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                invalid={!!errors.email}
                {...register("email", {
                  required: "Please enter your email.",
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Please enter a valid email address." },
                })}
              />
              {errors.email && <span className="field-err">{errors.email.message}</span>}
            </div>
            <div className="field">
              <Label htmlFor="password">Password</Label>
              <div className="pw-wrap">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  invalid={!!errors.password}
                  {...register("password", {
                    required: "Please enter your password.",
                    minLength:
                      mode === "signup"
                        ? { value: 8, message: "Password must be at least 8 characters." }
                        : undefined,
                  })}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <Icons.eyeOff size={17} /> : <Icons.eye size={17} />}
                </button>
              </div>
              {errors.password && <span className="field-err">{errors.password.message}</span>}
            </div>

            {error && (
              <div className="auth-error fade-in">
                <Icons.alert size={16} />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" size="lg" disabled={isSubmitting} style={{ width: "100%", marginTop: 4 }}>
              {isSubmitting ? (
                <>
                  <Spinner color="#fff" /> {mode === "signin" ? "Signing in…" : "Creating account…"}
                </>
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="auth-switch">
            {mode === "signin" ? (
              <>
                New to Ledgerline?{" "}
                <button type="button" onClick={() => { reset(); switchMode("signup"); }}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => { reset(); switchMode("signin"); }}>
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
