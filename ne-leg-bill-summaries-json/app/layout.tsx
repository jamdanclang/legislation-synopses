import './globals.css';
export const metadata = { title: 'NE Bill Summaries (JSON)' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <div className="mx-auto max-w-7xl p-4">{children}</div>
      </body>
    </html>
  );
}
