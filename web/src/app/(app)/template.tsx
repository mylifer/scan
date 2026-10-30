export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-in fade-in-50 slide-in-from-bottom-2 duration-200 ease-out">
      {children}
    </div>
  );
}
