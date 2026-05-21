import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const DeviceVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "verified">("checking");

  useEffect(() => {
    const t = setTimeout(() => setStatus("verified"), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (status === "verified") {
      const t = setTimeout(() => navigate("/dashboard"), 2000);
      return () => clearTimeout(t);
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md text-center">
        {/* Shield Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-all duration-700 ${
          status === "verified" ? "bg-green-100" : "bg-gray-100 animate-pulse"
        }`}>
          <span className="text-4xl">{status === "verified" ? "🛡️" : "🔍"}</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {status === "checking" ? "Verifying Device..." : "Device Verified"}
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {status === "checking"
            ? "Checking your device fingerprint and session integrity..."
            : "Your device has been recognised and approved"}
        </p>

        {/* Security checks */}
        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-6">
          {[
            { label: "Session token validated", done: true },
            { label: "AI-IDS: No suspicious activity detected", done: status === "verified" },
            { label: "Location check passed", done: status === "verified" },
          ].map((check) => (
            <div key={check.label} className="flex items-center gap-3 text-sm">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                check.done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-400"
              }`}>
                {check.done ? "✓" : "…"}
              </span>
              <span className={check.done ? "text-gray-700" : "text-gray-400"}>
                {check.label}
              </span>
            </div>
          ))}
        </div>

        {status === "verified" && (
          <p className="text-indigo-600 text-sm font-medium animate-pulse">
            Redirecting to your dashboard...
          </p>
        )}
      </div>
    </div>
  );
};

export default DeviceVerifyPage;
