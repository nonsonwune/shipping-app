import "./globals.css"

export const metadata = {
  title: "Shipping App",
  description: "Simple shipping application"
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}