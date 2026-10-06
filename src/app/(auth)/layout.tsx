import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-10" />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
