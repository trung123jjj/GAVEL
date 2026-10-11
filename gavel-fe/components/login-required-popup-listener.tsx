"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LoginRequiredModal from "@/components/login-required-modal";
import { consumeLoginRequiredPrompt, LOGIN_REQUIRED_EVENT } from "@/lib/api";

export default function LoginRequiredPopupListener() {
  const router = useRouter();
  const [show, setShow] = useState(false);

  function handleLogin() {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    setShow(false);
    router.push(`/auth/signin?returnTo=${encodeURIComponent(returnTo)}`);
  }

  useEffect(() => {
    function handleLoginRequired() {
      consumeLoginRequiredPrompt();
      setShow(true);
    }

    window.addEventListener(LOGIN_REQUIRED_EVENT, handleLoginRequired);
    if (consumeLoginRequiredPrompt()) window.setTimeout(handleLoginRequired, 0);
    return () => window.removeEventListener(LOGIN_REQUIRED_EVENT, handleLoginRequired);
  }, []);

  if (!show) return null;
  return (
    <LoginRequiredModal
      message="Bạn cần đăng nhập để sử dụng tính năng này."
      onClose={() => setShow(false)}
      onLogin={handleLogin}
    />
  );
}
