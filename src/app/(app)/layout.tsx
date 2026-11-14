import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DesktopSidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { PageTransition } from "@/components/app/page-transition";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const pendingCount = await prisma.approvalStep.count({
    where: { approverId: user.id, status: "PENDING", request: { orgId: user.orgId } },
  });

  return (
    <div className="relative isolate min-h-svh overflow-x-clip bg-zinc-50/70">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(1100px_340px_at_85%_-120px,rgba(99,102,241,0.10),transparent)]"
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora absolute -left-24 -top-32 size-[440px] rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="aurora-slow absolute -right-24 top-[22%] size-[400px] rounded-full bg-violet-400/12 blur-3xl" />
        <div className="aurora absolute bottom-[-14%] left-[38%] size-[380px] rounded-full bg-sky-300/12 blur-3xl [animation-delay:-6s]" />
      </div>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to content
      </a>
      <DesktopSidebar user={user} pendingCount={pendingCount} />
      <div className="lg:pl-[264px]">
        <Topbar user={user} pendingCount={pendingCount} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1440px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
