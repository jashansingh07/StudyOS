"use client";

import { useEffect, useState } from "react";

export default function TestApiPage() {
  const [result, setResult] = useState("Testing connection...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setResult(`Backend connected successfully: ${data.status}`);
      })
      .catch((error) => {
        console.error("Backend connection failed:", error);
        setResult("Connection failed. Check the backend and CORS settings.");
      });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">StudyOS API Test</h1>
        <p className="mt-4">{result}</p>
      </div>
    </main>
  );
}