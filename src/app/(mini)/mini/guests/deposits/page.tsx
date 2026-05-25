import { redirect } from 'next/navigation';

export default function MiniGuestDepositsRedirect() {
  redirect('/mini/received?tab=guests');
}
