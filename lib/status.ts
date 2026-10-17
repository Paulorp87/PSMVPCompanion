export const STATUSES = ["sem_status", "guardando", "loja", "vendido", "quebrou", "projeto"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = {
  sem_status: "Sem status",
  guardando: "Guardando",
  loja: "Indo pra loja",
  vendido: "Vendido",
  quebrou: "Quebrou",
  projeto: "Projeto",
};
