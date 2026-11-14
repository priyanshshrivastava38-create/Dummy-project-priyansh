import { Brand } from "@/components/brand";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-5 py-10">
      <div className="mb-8">
        <Brand href="/" />
      </div>
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm sm:p-8">
        <SignupForm />
      </div>
      <p className="mt-6 text-xs text-muted-foreground">Demo workspace · all data is seeded and resettable</p>
    </div>
  );
}
