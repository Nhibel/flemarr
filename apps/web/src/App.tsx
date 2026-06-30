import { useState } from 'react';

export function App() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkHealth() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>rom-curator</h1>
      <button onClick={() => void checkHealth()} disabled={loading}>
        {loading ? 'Checking…' : 'Check API health'}
      </button>
      {result !== null && <pre>{result}</pre>}
      {error !== null && <p style={{ color: 'red' }}>Error: {error}</p>}
    </main>
  );
}
