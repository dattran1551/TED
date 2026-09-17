import Link from 'next/link'

export function Nav() {
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="topnav-brand">
          <img src="/vnggames-logo.png" alt="VNGGames" />
        </Link>
      </div>
    </header>
  )
}
