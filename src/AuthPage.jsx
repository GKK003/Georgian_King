import React, { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
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
    ge: {
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

  function getAuthErrorMessage(err) {
    const messages = {
      "auth/email-already-in-use":
        lang === "ge"
          ? "ეს ელ-ფოსტა უკვე გამოყენებულია."
          : "Email already in use.",
      "auth/invalid-email":
        lang === "ge" ? "არასწორი ელ-ფოსტა." : "Invalid email.",
      "auth/weak-password":
        lang === "ge"
          ? "პაროლი მინიმუმ 6 სიმბოლო უნდა იყოს."
          : "Password must be at least 6 characters.",
      "auth/invalid-credential":
        lang === "ge"
          ? "არასწორი ელ-ფოსტა ან პაროლი."
          : "Invalid email or password.",
      "auth/popup-blocked":
        lang === "ge"
          ? "Popup დაიბლოკა. გადამისამართებით გაგრძელდება."
          : "Popup was blocked. Redirecting instead.",
      "auth/popup-closed-by-user":
        lang === "ge" ? "Google ფანჯარა დაიხურა." : "Google popup was closed.",
      "auth/unauthorized-domain":
        lang === "ge"
          ? "ეს დომენი Firebase-ში არ არის დამატებული."
          : "This domain is not authorized in Firebase.",
      "auth/operation-not-allowed":
        lang === "ge"
          ? "Firebase-ში ეს შესვლის მეთოდი ჩართული არ არის."
          : "This sign-in method is not enabled in Firebase.",
    };

    return messages[err.code] || err.message;
  }

  function getNativeGoogleErrorMessage(err) {
    const text = err?.message || err?.code || "";

    if (
      text.includes("default_web_client_id") ||
      text.includes("WILL_BE_OVERRIDDEN") ||
      text.includes("10:")
    ) {
      return lang === "ge"
        ? "APK-ში Google შესვლისთვის Firebase Android app და google-services.json უნდა დაემატოს."
        : "Google sign-in in the APK needs the Firebase Android app setup and google-services.json.";
    }

    return getAuthErrorMessage(err);
  }

  async function signInGoogle() {
    setError("");
    setLoading(true);

    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle({
          skipNativeAuth: true,
        });
        const idToken = result.credential?.idToken;
        const accessToken = result.credential?.accessToken;

        if (!idToken && !accessToken) {
          throw new Error("Google did not return a sign-in token.");
        }

        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        await signInWithCredential(auth, credential);
        return;
      }

      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (Capacitor.isNativePlatform()) {
        setError(getNativeGoogleErrorMessage(err));
        return;
      }

      if (err.code === "auth/popup-blocked") {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setError(getAuthErrorMessage(redirectErr));
          return;
        }
      }

      setError(getAuthErrorMessage(err));
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

        await updateProfile(cred.user, {
          displayName: name.trim() || email,
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
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
            type="button"
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
            type="button"
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
            type="submit"
            disabled={loading}
            className="min-h-[54px] w-full rounded-2xl bg-amber-300 px-5 font-black text-slate-950 hover:bg-amber-200 disabled:opacity-60"
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
          type="button"
          onClick={signInGoogle}
          disabled={loading}
          className="min-h-[54px] w-full rounded-2xl border border-white/10 bg-slate-950 px-5 font-black text-slate-100 hover:bg-white/5 disabled:opacity-60"
        >
          {loading ? "..." : ui.google}
        </button>
      </section>
    </main>
  );
}
