import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { CART_CONFIGS } from '../src/lib/merchant-config';
import { verifyPromoWithBrowser } from '../src/lib/promo-verification';
import { getCompanyById, type PromoCode } from '../src/lib/promocodes';

test('browser adds products, opens cart and waits for delayed discount; no checkout',async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html><body>
 <button id="add" onclick="sum+=600;document.querySelector('#total').textContent=sum+' ₽'">В корзину</button>
 <button id="cart" onclick="document.querySelector('.coupon').hidden=false">Корзина</button>
 <div id="total">0 ₽</div><div class="coupon" hidden><input name="promo"><button id="apply" onclick="document.querySelector('[role=status]').textContent='Промокод SAVE10 применён';setTimeout(()=>{document.querySelector('#total').textContent=(sum-100)+' ₽'},300)">Применить</button><p role="status"></p></div><script>let sum=0;</script></body></html>`);});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const old=CART_CONFIGS[54];const address=server.address() as {port:number};
 CART_CONFIGS[54]={...old,catalogUrl:`http://127.0.0.1:${address.port}`,addToCartSelector:'#add',cartLinkSelector:'#cart',promoInputSelector:'input[name=promo]',applyButtonSelector:'#apply',totalBeforeSelector:'#total',totalAfterSelector:'#total'};
 try {
 const offer:PromoCode={id:'test',companyId:54,code:'SAVE10',description:'test',discount:'100 ₽',status:'found',sources:[],found:Date.now(),conditions:[],minOrder:1000};
 const result=await verifyPromoWithBrowser(offer,getCompanyById(54)!);
 assert.equal(result.status,'verified',result.details);assert.equal(result.evidence?.totalBefore,1200);assert.equal(result.evidence?.totalAfter,1100);
 }finally{CART_CONFIGS[54]=old;await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
