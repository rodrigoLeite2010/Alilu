import "@/app/imoveis/imoveis.css";
export default function DesapegoLayout({children}:{children:React.ReactNode}){
  return <div className="property-portal mx-auto max-w-6xl px-4 py-6 sm:py-10">{children}</div>;
}
