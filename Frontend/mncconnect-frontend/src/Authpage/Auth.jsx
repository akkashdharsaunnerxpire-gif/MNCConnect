import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Users,
  BriefcaseBusiness,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-white px-5 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <Sparkles className="h-5 w-5" />
          </div>

          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-indigo-600">
            MNC CONNECT
          </p>

          <h2 className="mt-2 text-3xl font-black text-slate-950">
            Choose your path
          </h2>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
            Freshers connect with industry.
            MNC employees build professional influence.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="group rounded-2xl border border-slate-200 p-5 text-left transition hover:-translate-y-1 hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Users className="h-5 w-5" />
              </div>

              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-600" />
            </div>

            <p className="mt-6 text-xs font-bold text-indigo-600">
              PATH 01
            </p>

            <h3 className="mt-1 text-2xl font-black text-slate-950">
              Fresher
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Login to your account or create
              a new fresher account.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/employee-profile")}
            className="group rounded-2xl border border-slate-200 p-5 text-left transition hover:-translate-y-1 hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <BriefcaseBusiness className="h-5 w-5" />
              </div>

              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600" />
            </div>

            <p className="mt-6 text-xs font-bold text-emerald-600">
              PATH 02
            </p>

            <h3 className="mt-1 text-2xl font-black text-slate-950">
              MNC Employee
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Create your professional profile
              and submit employment proof.
            </p>
          </button>
        </div>

        <div className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span className="text-xs font-bold tracking-widest text-slate-400">
            SECURE ENTRY
          </span>
        </div>
      </div>
    </div>
  );
}