import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

export default function AuthPage({ lang = "en" }) {
  const [mode, setMode] = useState("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const t = {
    en: {
      title: "King Online",
      subtitle: "Play King online with friends.",
      register: "Register",
      login: "Login",
      name: "Your name",
      email: "Email address",
      password: "Password",
      google: "Continue with Google",
      or: "or",
      submitRegister: "Create account",
      submitLogin: "Sign in",
    },
    ka: {
      title: "კინგი ონლაინ",
      subtitle: "ითამაშე კინგი ონლაინ მეგობრებთან.",
      register: "რეგისტრაცია",
      login: "შესვლა",
      name: "შენი სახელი",
      email: "ელ-ფოსტა",
      password: "პაროლი",
      google: "Google-ით გაგრძელება",
      or: "ან",
      submitRegister: "ანგარიშის შექმნა",
      submitLogin: "შესვლა",
    },
  };

  const ui = t[lang] || t.en;

  async function signInGoogle() {
    setError("");
    setLoading(true);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await updateProfile(cred.user, { displayName: name.trim() || email });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const messages = {
        "auth/email-already-in-use":
          lang === "ka"
            ? "ეს ელ-ფოსტა უკვე გამოყენებულია."
            : "Email already in use.",
        "auth/invalid-email":
          lang === "ka" ? "არასწორი ელ-ფოსტა." : "Invalid email.",
        "auth/weak-password":
          lang === "ka"
            ? "პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს."
            : "Password must be at least 6 characters.",
        "auth/invalid-credential":
          lang === "ka"
            ? "არასწორი ელ-ფოსტა ან პაროლი."
            : "Invalid email or password.",
      };

      setError(messages[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <section className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-300 text-3xl font-black text-slate-950">
            ♠
          </div>
          <h1 className="text-4xl font-black">{ui.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{ui.subtitle}</p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-1">
          <button
            onClick={() => setMode("register")}
            className={
              mode === "register"
                ? "rounded-xl bg-amber-300 py-3 font-black text-slate-950"
                : "rounded-xl py-3 font-black text-slate-400"
            }
          >
            {ui.register}
          </button>
          <button
            onClick={() => setMode("login")}
            className={
              mode === "login"
                ? "rounded-xl bg-amber-300 py-3 font-black text-slate-950"
                : "rounded-xl py-3 font-black text-slate-400"
            }
          >
            {ui.login}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={ui.name}
              className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 font-bold outline-none focus:border-amber-300"
            />
          )}

          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={ui.email}
            required
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 font-bold outline-none focus:border-amber-300"
          />

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={ui.password}
            required
            className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 font-bold outline-none focus:border-amber-300"
          />

          <button
            disabled={loading}
            className="min-h-[54px] w-full rounded-2xl bg-amber-300 px-5 font-black text-slate-950 disabled:opacity-60"
          >
            {loading
              ? "..."
              : mode === "register"
                ? ui.submitRegister
                : ui.submitLogin}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-bold text-slate-500">{ui.or}</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          onClick={signInGoogle}
          disabled={loading}
          className="min-h-[54px] w-full rounded-2xl border border-white/10 bg-slate-950 px-5 font-black text-slate-100 hover:bg-white/5 disabled:opacity-60"
        >
          {ui.google}
        </button>
      </section>
    </main>
  );
}
