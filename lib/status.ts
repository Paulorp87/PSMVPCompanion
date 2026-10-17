export const STATUSES = ["guardando", "loja", "vendido", "quebrou", "projeto"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  guardando: "Guardando",
  loja: "Indo pra loja",
  vendido: "Vendido",
  quebrou: "Quebrou",
  projeto: "Projeto",
};
