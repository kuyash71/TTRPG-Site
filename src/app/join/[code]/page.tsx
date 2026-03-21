"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function joinSession() {
      const res = await fetch("/api/sessions/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage("Session'a başarıyla katıldın!");
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        setStatus("error");
        setMessage(data.error || "Bir hata oluştu.");
      }
    }

    joinSession();
  }, [code, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
        <h1 className="mb-4 text-xl font-bold text-gray-100">Session Katılım</h1>

        {status === "loading" && (
          <p className="text-gray-400">Katılım işleniyor...</p>
        )}

        {status === "success" && (
          <>
            <p className="text-green-400">{message}</p>
            <p className="mt-2 text-sm text-gray-500">
              Dashboard&apos;a yönlendiriliyorsun...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-red-400">{message}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-gray-100 hover:bg-amber-500"
            >
              Dashboard&apos;a Dön
            </button>
          </>
        )}
      </div>
    </main>
  );
}
