"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { isOutsideApp } from "@/lib/links";

/** /umbracaelis adreslerini düz <a> ile, diğerlerini next/link ile açar. */
export function AppLink({ href, children, ...rest }: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string }) {
  if (isOutsideApp(href))
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}

/** Programatik geçiş: /umbracaelis için tam sayfa, diğerleri için istemci yönlendirmesi. */
export function useGo() {
  const router = useRouter();
  return useCallback(
    (href: string, opts?: { replace?: boolean }) => {
      if (isOutsideApp(href)) {
        if (opts?.replace) window.location.replace(href);
        else window.location.assign(href);
        return;
      }
      if (opts?.replace) router.replace(href);
      else router.push(href);
      router.refresh();
    },
    [router],
  );
}
