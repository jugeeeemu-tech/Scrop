export function Header() {
  return (
    <header className="sticky top-0 z-20 h-[var(--header-height)] bg-gray-900 text-white shadow-lg">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">📦</div>
          <h1 className="text-xl font-bold tracking-tight">Scrop</h1>
          <span className="text-sm text-gray-400">Packet Capture Visualizer</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Status: <span className="text-green-400">Ready</span></span>
        </div>
      </div>
    </header>
  );
}
