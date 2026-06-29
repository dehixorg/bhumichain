import { redirect } from 'next/navigation';

// Root redirects to login — login page handles role-based redirect after auth
export default function Home() {
  redirect('/login');
}
