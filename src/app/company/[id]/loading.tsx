export default function LoadingCompany() {
  return <main className="content-page" aria-busy="true">
    <p role="status" className="text-xl font-medium">Открываем промокоды ВкусВилл…</p>
    <div aria-hidden="true" className="skeleton mt-7 h-32" />
    <div aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-2">
      {[0,1].map(index => <div key={index} className="skeleton h-48" />)}
    </div>
  </main>;
}
