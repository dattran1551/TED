'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Trang chính' },
  { href: '/glossary', label: 'Bảng thuật ngữ' },
  { href: '/history', label: 'Lịch sử' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="topnav-brand">
          <img src="/vnggames-logo.png" alt="VNGGames" />
        </Link>
        <nav className="topnav-links" aria-label="Điều hướng chính">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname === link.href ? 'topnav-link is-active' : 'topnav-link'}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
