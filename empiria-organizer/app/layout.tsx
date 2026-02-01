import { Auth0Provider } from '@auth0/nextjs-auth0/client';
import "./globals.css"; // Ensure you have your Tailwind directives here

export const metadata = {
  title: 'Empiria Organizer',
  description: 'Organizer Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <Auth0Provider>
        <body>{children}</body>
      </Auth0Provider>
    </html>
  );
}
