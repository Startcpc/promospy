import { NextResponse } from 'next/server';
// General catalogue scanning has been removed. Search is scoped to a merchant page.
export async function GET(){return NextResponse.json({error:'Откройте страницу ВкусВилл для поиска промокодов.'},{status:410});}
