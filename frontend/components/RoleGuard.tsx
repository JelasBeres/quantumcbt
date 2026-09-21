"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, User } from "@/lib/auth";

type RoleGuardProps = {
  children: ReactNode;
  roles: User["role"][];
};

export default function RoleGuard({ children, roles }: RoleGuardProps) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!roles.includes(user.role)) {
      router.replace(
        user.role === "siswa"
          ? "/siswa/dashboard"
          : user.role === "guru"
            ? "/guru/dashboard"
            : "/admin/dashboard"
      );
      return;
    }
    setAllowed(true);
  }, [roles, router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral text-sm text-text-muted">
        Memeriksa akses...
      </div>
    );
  }

  return <>{children}</>;
}
