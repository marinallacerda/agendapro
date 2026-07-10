export default function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6">
      {children}
    </div>
  );
}
