export type Obligation = { id: string; text: string };

export type Regulation = {
  id: string;
  jurisdiction: string;
  title: string;
  summary: string;
  obligations: Obligation[];
};

export type Clause = {
  id: string;
  text: string;
  linked_regs: string[];
};

export type ExtractionStatus = "pending" | "processing" | "complete" | "failed";

export type Contract = {
  id: string;
  name: string;
  counterparty: string;
  value: number;
  clauses: Clause[];
  extraction_status: ExtractionStatus;
  extraction_error: string | null;
  is_sample: boolean;
  source_file_url: string | null;
};


export type FederalRegisterDoc = {
  document_number: string;
  title: string;
  publication_date: string;
  agencies: { name: string }[];
  html_url: string;
  type?: string;
};
