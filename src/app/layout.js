import './globals.css';

export const metadata = {
  title: 'NLP 2026 Call Campaign',
  description: 'Enterprise call campaign management for NLP UK & Europe 2026',
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a0a0f',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet" />
      </head>
      <body>
        {children}
        <div id="toast-root" className="toast-container"></div>
      </body>
    </html>
  );
}
