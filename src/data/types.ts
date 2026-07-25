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

export type Contract = {
  id: string;
  name: string;
  counterparty: string;
  value: number;
  clauses: Clause[];
};

export type FederalRegisterDoc = {
  document_number: string;
  title: string;
  publication_date: string;
  agencies: { name: string }[];
  html_url: string;
  type?: string;
};
