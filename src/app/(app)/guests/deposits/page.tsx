import { redirect } from 'next/navigation';

export default function GuestDepositsRedirect() {
  redirect('/deposits?tab=guests');
}
