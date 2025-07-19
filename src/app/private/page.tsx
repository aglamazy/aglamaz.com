import { cookies } from 'next/headers';
import { initAdmin, adminAuth } from '../../firebase/admin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PrivatePage() {
  initAdmin();
  const token = cookies().get('token')?.value;
  if (!token) {
    return (
      <main className="flex flex-col items-center justify-center h-screen">
        <p>No token found. Please <Link href="/">login</Link>.</p>
      </main>
    );
  }
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const { name, picture } = decoded;
    return (
      <main className="flex flex-col items-center justify-center h-screen gap-4">
        {picture && <img src={picture} alt="avatar" className="w-24 h-24 rounded-full" />}
        <p>Hello, {name}</p>
        <form action="/api/logout" method="post">
          <button className="bg-gray-800 text-white px-4 py-2" type="submit">Logout</button>
        </form>
      </main>
    );
  } catch (e) {
    return (
      <main className="flex flex-col items-center justify-center h-screen">
        <p>Invalid token. Please <Link href="/">login again</Link>.</p>
      </main>
    );
  }
}
