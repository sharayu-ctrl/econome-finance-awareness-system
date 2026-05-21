import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const OTPPage: React.FC = () => {
  const navigate = useNavigate();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(30);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  const handleChange = (val: string, idx: number) => {
    if (!/^\d*$/.test(val)) return;
    const updated = [...otp];
    updated[idx] = val.slice(-1);
    setOtp(updated);
    if (val && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }
    navigate("/device-verify");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">📧</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Verify your identity</h1>
        <p className="text-gray-500 text-sm mb-6">
          Enter any 6-digit code to continue
        </p>

        <div className="flex justify-center gap-3 mb-4">
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => (inputs.current[idx] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(e.target.value, idx)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className="w-11 h-12 border-2 border-gray-200 rounded-lg text-center text-lg font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          ))}
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <button
          onClick={handleVerify}
          className="w-full bg-gray-900 text-white rounded-xl py-3 font-medium hover:bg-gray-700 mb-4"
        >
          Verify OTP
        </button>

        <div className="text-sm text-gray-500">
          {timer > 0 ? (
            <span>Resend OTP in <span className="font-medium text-gray-700">{timer}s</span></span>
          ) : (
            <button onClick={() => setTimer(30)} className="text-indigo-600 hover:underline font-medium">
              Resend OTP
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OTPPage;
