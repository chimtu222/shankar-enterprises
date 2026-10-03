"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("phone", phone)
      .eq("password", password)
      .single();

    if (error || !data) {
      setError("Invalid Phone Number or Password");
      return;
    }

    if (!data.is_active) {
      setError("Account Disabled");
      return;
    }

    localStorage.setItem("user", JSON.stringify(data));

    if (data.role === "ADMIN") {
      router.push("/admin");
    } else {
      router.push("/products");
    }
  };

  return (
    <div className="min-h-screen bg-[#eef6f5] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">

        <div className="flex flex-col items-center mb-8">
          <img src="/SE_logo.png" alt="Logo" className="w-16 h-16" />

          <h1 className="mt-4 text-sm tracking-[4px] font-semibold text-teal-600 uppercase">
            Sankar Enterprises
          </h1>

          <h1 className="mt-4 text-4xl font-semibold text-gray-900">
            Sign In
          </h1>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-800 mb-2">
            Phone Number
          </label>

          <input
            type="text"
            placeholder="Enter phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-800 mb-2">
            Password
          </label>

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-20 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-teal-600 font-medium text-sm"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4">
            {error}
          </p>
        )}

        <button
          onClick={handleLogin}
          className="w-full bg-[#082f3f] hover:bg-[#0b3d52] text-white py-3 rounded-xl font-semibold transition-all"
        >
          Log In
        </button>

      </div>
    </div>
  );
}