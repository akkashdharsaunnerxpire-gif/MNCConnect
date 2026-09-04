import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, Mail, ArrowRight, AlertCircle } from "lucide-react";
import socket from "../socket";

const API_URL = import.meta.env.VITE_API_URL;

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-amber-500 focus:ring-4 focus:ring-amber-50";

const PRIMARY_ACTION =
  "border-transparent bg-[linear-gradient(135deg,#111827_0%,#1d4ed8_42%,#06b6d4_100%)] text-white shadow-[0_14px_40px_rgba(37,99,235,.24)]";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/mentor/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setError("Invalid email or password. Please try again.");
        } else if (response.status === 403) {
          setError(
            data.message ||
            "Your account is pending approval. Please wait for admin verification."
          );
        } else if (response.status === 404) {
          setError(
            data.message || "Account not found. Please register first."
          );
        } else if (response.status === 500) {
          setError("Server error. Please try again later.");
        } else {
          setError(data.message || "Login failed. Please try again.");
        }

        return;
      }

      if (!data.token) {
        throw new Error(
          "Login successful, but authentication token is missing."
        );
      }

      if (!data.mentor) {
        throw new Error(
          "Mentor information is missing from server response."
        );
      }

      const mentorId = data.mentor.id;

      if (!mentorId) {
        throw new Error(
          "Mentor ID is missing from server response."
        );
      }

      localStorage.setItem("mnc_mentor_token", data.token);
      localStorage.setItem("user", JSON.stringify(data.mentor));
      localStorage.setItem("mentor", JSON.stringify(data.mentor));

      // IMPORTANT
      localStorage.setItem("mentorId", mentorId);

      console.log("Mentor login successful");
      console.log("Mentor ID:", mentorId);

      const emitMentorOnline = () => {
        console.log("Socket connected:", socket.id);

        socket.emit("mentor-online", {
          mentorId,
        });

        console.log("mentor-online emitted:", mentorId);

        navigate("/mentor/home");
      };

      if (socket.connected) {
        socket.emit("mentor-online", {
          mentorId,
        });
      } else {
        socket.connect();
      }

      navigate("/mentor/home");
    } catch (error) {
      console.error("Login error:", error);

      if (error.message === "Failed to fetch") {
        setError(
          "Cannot connect to server. Please check your connection."
        );
      } else {
        setError(
          error.message || "An unexpected error occurred."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white/90 p-7 shadow-[0_25px_80px_rgba(15,23,42,.08)] backdrop-blur-sm sm:p-10">
      <div className="pb-6 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">
            MNC Employee / Mentor
          </p>
        </div>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Welcome Back
        </h1>

        <p className="max-w-2xl mt-3 text-sm leading-6 text-slate-500">
          Login to your mentor account to manage your profile and help freshers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 mt-7">
        {error && (
          <div className="flex items-start gap-3 p-4 border border-red-200 rounded-xl bg-red-50">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <p className="text-sm font-medium text-red-700">
              {error}
            </p>
          </div>
        )}

        <div>
          <label className="block mb-2 text-sm font-semibold text-slate-700">
            <Mail className="inline-block w-4 h-4 mr-1 text-slate-400" />
            Professional Email
            <span className="ml-1 text-red-500">*</span>
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="arun@company.com"
            className={inputClass}
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block mb-2 text-sm font-semibold text-slate-700">
            <Lock className="inline-block w-4 h-4 mr-1 text-slate-400" />
            Password
            <span className="ml-1 text-red-500">*</span>
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className={inputClass}
            required
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm">
            <Link
              to="/mentor/forgot-password"
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Forgot Password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3.5 text-sm font-bold transition disabled:opacity-70 ${PRIMARY_ACTION}`}
        >
          {isLoading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white rounded-full animate-spin border-t-transparent" />
              Logging in...
            </>
          ) : (
            <>
              Login
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="mt-4 text-sm text-center text-slate-600">
          Don't have an account?{" "}
          <Link
            to="/mentor/register"
            className="font-semibold text-blue-600 hover:text-blue-700"
          >
            Register
          </Link>
        </p>
      </form>
    </section>
  );
}