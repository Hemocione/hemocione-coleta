export interface TeamColor {
  hex: string;
  name: string;
}

export const TEAM_COLORS: TeamColor[] = [
  { hex: "#dc2626", name: "Vermelho" },
  { hex: "#ea580c", name: "Laranja" },
  { hex: "#d97706", name: "Âmbar" },
  { hex: "#ca8a04", name: "Amarelo" },
  { hex: "#65a30d", name: "Verde" },
  { hex: "#16a34a", name: "Verde Esmeralda" },
  { hex: "#059669", name: "Verde Teal" },
  { hex: "#0d9488", name: "Ciano" },
  { hex: "#0891b2", name: "Azul Ciano" },
  { hex: "#0284c7", name: "Azul" },
  { hex: "#2563eb", name: "Azul Índigo" },
  { hex: "#7c3aed", name: "Roxo" },
  { hex: "#9333ea", name: "Violeta" },
  { hex: "#c026d3", name: "Rosa" },
  { hex: "#db2777", name: "Rosa Pink" },
  { hex: "#6b7280", name: "Cinza" },
];

export const getColorName = (hex: string): string => {
  const color = TEAM_COLORS.find(c => c.hex === hex);
  return color?.name || "Cor personalizada";
};
