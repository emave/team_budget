import { redirect } from 'next/navigation';

export default function MiniGuestDepositsRedirect() {
  redirect('/mini/deposits?tab=guests');
}
