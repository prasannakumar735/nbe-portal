import { redirect } from 'next/navigation';
export default function SavedQuotesRedirectPage() {
    redirect('/dashboard/quotes/service');
}
