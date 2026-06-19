import { redirect } from 'next/navigation';

// Root redirects to map (the primary scene-entry point for the demo)
export default function Home() {
  redirect('/map');
}
