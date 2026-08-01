import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { MotionPage } from "@/layout/MotionPage";

export default function RegisterPage() {
  return (
    <MotionPage>
      <AuthShell mode="register"><AuthForm mode="register" /></AuthShell>
    </MotionPage>
  );
}
