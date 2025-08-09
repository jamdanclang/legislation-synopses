export type Agency = { id:number; name:string; slug:string };
export type Bill = {
  id: number;
  number: string;
  title: string;
  status: string | null;
  introduced_date: string | null;
  sponsor: string | null;
  committee: string | null;
  general_summary: string | null;
  impact_summary: string | null;
  official_url: string | null;
  text_pdf_url: string | null;
  soi_pdf_url: string | null;
  fiscal_pdf_url: string | null;
  agencies: Agency[];
};
