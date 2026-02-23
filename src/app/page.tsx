import { ChartPolar, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

export default function GlobalDashboard() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-slate-50">

      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-900/20">
          <ChartPolar weight="fill" className="text-white w-10 h-10" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">CapitalBase</h1>
        <p className="text-slate-400 font-medium">Global Entity Search & Financial Terminal</p>
      </div>

      {/* Big Global Search Bar */}
      <div className="w-full max-w-2xl relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <MagnifyingGlass weight="bold" className="h-5 w-5 text-slate-400" />
        </div>
        <input
          type="text"
          placeholder="Search for a company, director, or SIC code..."
          className="block w-full pl-12 pr-4 py-4 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-xl transition-all"
        />
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
          <span className="text-xs font-mono bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-600">⌘K</span>
        </div>
      </div>

    </div>
  );
}