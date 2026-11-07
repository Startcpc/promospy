import Link from 'next/link';
export default function NotFound() {
  return <main className="mx-auto max-w-5xl px-5 py-16 text-[#16213e]">
    <h1 className="text-3xl font-black">Страница не найдена</h1>
    <Link href="/" className="mt-6 inline-block text-lg underline">К магазинам</Link>
  </main>;
}
