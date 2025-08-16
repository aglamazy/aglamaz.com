'use client';
import { useState, useEffect } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/utils/apiFetch';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(10);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() })
      });
      if (res.ok) {
        setSuccess(true);
        setName('');
        setEmail('');
        setMessage('');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit');
      }
    } catch (err) {
      setError('Failed to submit');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (success) {
      setCountdown(10);
      const interval = setInterval(() => {
        setCountdown((c) => c - 1);
      }, 1000);
      const timeout = setTimeout(() => {
        router.push('/');
      }, 10000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [success, router]);

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Thank you for contacting us! We will get back to you shortly.</h3>
          <div className="text-gray-500 mt-2">Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}…</div>
          <button className="mt-4 underline" onClick={() => setSuccess(false)}>Send another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-4">
        <h1 className="text-2xl font-bold text-center">Contact Us</h1>
        {error && <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-gray-700 text-sm mb-1" htmlFor="name">Name</label>
          <input id="name" type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2" disabled={isLoading} />
        </div>
        <div>
          <label className="block text-gray-700 text-sm mb-1" htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2" disabled={isLoading} />
        </div>
        <div>
          <label className="block text-gray-700 text-sm mb-1" htmlFor="message">Message</label>
          <textarea id="message" value={message} onChange={e => setMessage(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2" rows={5} disabled={isLoading}></textarea>
        </div>
        <button type="submit" className="w-full bg-gray-900 text-white py-2 rounded-lg font-semibold hover:bg-gray-800 transition disabled:opacity-50" disabled={isLoading}>
          {isLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin inline"/>Sending...</>) : 'Send'}
        </button>
      </form>
    </div>
  );
}
