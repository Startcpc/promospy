// Deterministic checks of the store catalogue and offer text.
import assert from 'node:assert/strict';
import { ALLO_ID, companies, EDO_ID, FOX_ID, METRO_ID } from '../src/lib/companies';
import { matchesPromoQuery, getCompanyById, type PromoCode } from '../src/lib/promocodes';
assert.deepEqual(companies.map(company => company.id),[54,401,402,403,404,405,201,METRO_ID,EDO_ID,FOX_ID,ALLO_ID]);
for (const id of [5,102,202,203,204,205,206,207,208,301,302,999]) assert.equal(getCompanyById(id),undefined);
const offer: PromoCode = {id:'54:MiXeD20',companyId:54,code:'MiXeD20',description:'Скидка на первый заказ',discount:'20%',conditions:['Заказ от 1500 рублей','Только в приложении'],sources:[],found:100,status:'found'};
for (const query of ['', 'mixed20', 'СКИДКА', 'первый 1500', '20% приложении', '  заказ   рублей ']) assert.ok(matchesPromoQuery(offer,query),query);
for (const query of ['Ozon','повторный','2000','mixed21','первый 2000']) assert.equal(matchesPromoQuery(offer,query),false,query);
console.log('25 checks passed: supported merchants, unsupported IDs, and offer searches.');
