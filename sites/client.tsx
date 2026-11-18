import { createRoot } from "react-dom/client";
import Home from "../src/app/page";
import SavedPage from "../src/app/saved/page";
import NotFound from "../src/app/not-found";
import { CompanyResults } from "../src/components/company-results";
import { getCompanyById } from "../src/lib/promocodes";

const path = location.pathname.replace(/\/$/, "");
const id = Number(/^\/company\/(\d+)$/.exec(path)?.[1]);
const merchant = getCompanyById(id);
if (merchant) document.title = `Промокоды ${merchant.name} · PromoSpy`;
createRoot(document.getElementById("app")!).render(
  path === "" ? <Home/> : path === "/saved" ? <SavedPage/> : merchant ? <CompanyResults id={id} hosted/> : <NotFound/>
);
