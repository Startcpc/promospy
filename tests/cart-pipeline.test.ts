import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkOfficialCarts } from "../src/lib/scan-engine";
import { parsePublicOfficial } from "../src/lib/public-official";
import { currentCartCheck, getCompanyById } from "../src/lib/promocodes";
import { classifyCartObservation, messageContainsCode, parseCartTotal } from "../src/lib/promo-verification";

test("cart errors keep official publication and successful cart evidence expires independently", async () => {
 const codes=parsePublicOfficial(54,readFileSync(new URL('./fixtures/vkusvill-official.html',import.meta.url),'utf8'));
 const checked=codes[0].checked;
 await checkOfficialCarts(codes,getCompanyById(54)!,new AbortController().signal,()=>{},[],async()=>({status:'unavailable',details:'Нужен адрес'}));
 assert.equal(codes[0].status,'official');assert.equal(codes[0].checked,checked);
 assert.equal(codes[0].evidence?.cartCheck?.details,'Нужен адрес');
 await checkOfficialCarts(codes,getCompanyById(54)!,new AbortController().signal,()=>{},[],async()=>({status:'verified',details:'1000 → 800'}));
 assert.equal(currentCartCheck(codes[0])?.status,'verified');
 assert.equal(currentCartCheck(codes[0],Date.now()+7*3600000)?.status,'unavailable');
 assert.equal(codes[0].status,'official');
});
test("cart evidence rejects prefix matches, ambiguous sums, impossible totals and account conditions",()=>{
 assert.equal(messageContainsCode('Промокод SAVE100 применён','SAVE10'),false);
 assert.equal(messageContainsCode('Код «1раз» применён','1раз'),true);
 assert.equal(parseCartTotal('Товары 1000 ₽ Доставка 200 ₽'),undefined);
 assert.equal(parseCartTotal('Итого 1 200,50 ₽'),1200.5);
 const observation={code:'X1',appliedCode:'X1',message:'Промокод X1 применён',totalBefore:1000,totalAfter:800,minOrder:500};
 assert.equal(classifyCartObservation({...observation,totalAfter:-100}).status,'unavailable');
 assert.equal(classifyCartObservation({...observation,message:'Промокод недействителен: только первый заказ'}).status,'unavailable');
});
