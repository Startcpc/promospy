import { NextResponse } from 'next/server';
// Search is scoped to each merchant page.
export async function GET(){return NextResponse.json({error:'Выберите магазин и откройте его страницу для поиска промокодов.'},{status:410});}
