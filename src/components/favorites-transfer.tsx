"use client";

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useSavedPromos, importFavorites } from '@/hooks/use-saved-promos';
import { exportSavedPromos, MAX_FAVORITES_FILE_BYTES } from '@/lib/saved-promos';

export function FavoritesTransfer() {
  const {items,hydrated} = useSavedPromos();
  const input = useRef<HTMLInputElement>(null);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [reading,setReading] = useState(false);
  const download = () => {
    setError('');setMessage('');
    try {
      const url = URL.createObjectURL(new Blob([exportSavedPromos(items)],{type:'application/json;charset=utf-8'}));
      const link = document.createElement('a');link.href=url;link.download=`promospy-favorites-${new Date().toISOString().slice(0,10)}.json`;
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),10000);
      setMessage('Файл готов. Его можно загрузить в другом браузере.');
    } catch {setError('Не удалось скачать избранное. Попробуйте ещё раз.');}
  };
  return <details className="mb-5 rounded-lg border bg-white p-3">
    <summary className="cursor-pointer font-semibold">Перенос избранного</summary>
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" disabled={!hydrated || !items.length} onClick={download} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><Download aria-hidden="true" className="h-4 w-4" />Скачать файл</button>
      <button type="button" disabled={!hydrated || reading} onClick={()=>input.current?.click()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><Upload aria-hidden="true" className="h-4 w-4" />{reading?'Читаем файл…':'Загрузить файл'}</button>
      <input ref={input} type="file" accept=".json,application/json" aria-label="Файл избранного" className="hidden" onChange={async event=>{
        const file = event.target.files?.[0];event.target.value='';if(!file)return;
        setError('');setMessage('');setReading(true);
        try {
          if(file.size>MAX_FAVORITES_FILE_BYTES)throw new Error('Файл слишком большой. Максимум — 4 МБ.');
          const result=importFavorites(await file.text());
          setMessage((result.added?`Добавлено кодов: ${result.added}. Существующие сохранены.`:'Все коды уже есть в избранном.')+(result.skipped?` Пропущено записей других магазинов: ${result.skipped}. Исходный файл не изменён.`:''));
          if(result.warning)setError(result.warning);
        } catch(error){setError(error instanceof Error?error.message:'Не удалось загрузить файл. Избранное не изменено.');}
        finally{setReading(false);}
      }} />
    </div>
    {message&&<p role="status" className="mt-3 text-sm">{message}</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </details>;
}
