import SiswaShell from "@/components/SiswaShell";
import "./student.css";
import RoleGuard from "@/components/RoleGuard";
import { ReactNode } from "react";

export default function SiswaLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard roles={["siswa"]}>
      <SiswaShell>{children}</SiswaShell>
    </RoleGuard>
  );
}
