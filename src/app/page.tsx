import { redirect } from 'next/navigation';
import { isConnected } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export default function Home() {
  redirect(isConnected() ? '/account' : '/patient/overview');
}
