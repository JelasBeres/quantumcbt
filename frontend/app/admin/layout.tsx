import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import RoleGuard from "@/components/RoleGuard";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard roles={["admin"]}>
      <div className="min-h-screen bg-transparent">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
          <BackButton />
          {children}
        </main>
      </div>
    </RoleGuard>
  );
}
