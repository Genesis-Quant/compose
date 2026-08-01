import { AuthForm } from "@/components/auth/AuthForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { MotionPage } from "@/layout/MotionPage";

export default function LoginPage() {
  return (
    <MotionPage>
      <AuthShell mode="login"><AuthForm mode="login" /></AuthShell>
    </MotionPage>
  );
}
