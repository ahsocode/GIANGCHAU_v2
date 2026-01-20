import ChamCongTabs from "./ui/cham-cong-tabs";

export default function ChamCongLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <ChamCongTabs />
      {children}
    </div>
  );
}
