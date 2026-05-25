import { redirect } from 'next/navigation';

export default function GuestDepositsRedirect() {
  redirect('/received?tab=guests');
}
