export default function LoadingCompany() {
  return <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6" aria-busy="true">
    <p role="status" className="text-xl font-bold">Открываем магазин…</p>
    <div aria-hidden="true" className="mt-6 h-24 rounded-lg bg-[#eff4ff]" />
    <div aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-2">
      {[0,1].map(index => <div key={index} className="h-36 rounded-lg border-2 border-[#16213e] bg-white" />)}
    </div>
  </main>;
}
