import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCartObservation, messageContainsCode, parseCartTotal, type CartObservation } from '../src/lib/promo-verification';
const baseline: CartObservation={code:'SAVE10',appliedCode:'SAVE10',message:'Промокод SAVE10 применён',totalBefore:1500,totalAfter:1350,minOrder:1000};
const cases: [string,Partial<CartObservation>,string][] = [
 ['01: actual measured discount confirms this code',{},'verified'],
 ['02: another applied code cannot confirm ours',{appliedCode:'SAVE100'},'unavailable'],
 ['03: unchanged sum is not proof of a discount',{totalAfter:1500},'unavailable'],
 ['04: increased sum is not proof of a discount',{totalAfter:1600},'unavailable'],
 ['05: empty widget response cannot confirm a code',{message:''},'unavailable'],
 ['06: account login requirement is not code rejection',{message:'Войдите в аккаунт'},'unavailable'],
 ['07: address requirement is not code rejection',{message:'Укажите адрес доставки'},'unavailable'],
 ['08: first order restriction needs eligible account',{message:'Код недействителен: только первый заказ'},'unavailable'],
 ['09: explicit campaign expiry is distinguished',{message:'Срок действия промокода истёк'},'expired'],
 ['10: explicit invalid code is rejected for this basket',{message:'Промокод не найден'},'rejected'],
];
for(const [name,change,expected] of cases)test(name,()=>assert.equal(classifyCartObservation({...baseline,...change}).status,expected));
const amounts: [string,string,number|undefined][]=[
 ['11: amount supports grouped rubles and kopecks','Итого 1 500,25 ₽',1500.25],
 ['12: summary with delivery and goods is ambiguous','Товары 1500 ₽ Доставка 200 ₽',undefined],
 ['13: missing total is not treated as zero','Итого уточняется',undefined],
 ['14: unlabelled digits mixed with text are ambiguous','2 товара 1500',undefined],
 ['15: isolated numeric total can be read','1500.25',1500.25],
];
for(const [name,value,expected] of amounts)test(name,()=>assert.equal(parseCartTotal(value),expected));
const identities: [string,string,string,boolean][]=[
 ['16: prefix code cannot match a longer code','SAVE100 применён','SAVE10',false],
 ['17: suffix code cannot match embedded token','XSAVE10 применён','SAVE10',false],
 ['18: Cyrillic code matches inside quotes','Промокод «1раз» применён','1раз',true],
 ['19: code matching preserves case','SAVE10 применён','save10',false],
 ['20: hyphenated code remains one identity','Промокод SAVE-10 применён','SAVE-10',true],
];
for(const [name,message,code,expected] of identities)test(name,()=>assert.equal(messageContainsCode(message,code),expected));
